import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { authConfig } from "@/lib/auth.config";
import { normalizeUsername } from "@/lib/username";
import {
  LOGIN_USER_LIMIT,
  consumeRateLimit,
} from "@/lib/rate-limit";

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!login || !password) return null;

        const username = normalizeUsername(login);

        const userLimited = consumeRateLimit(
          `login:user:${username}`,
          LOGIN_USER_LIMIT,
        );
        if (!userLimited.ok) {
          throw new RateLimitedError();
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        await createAuditLog({
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
          details: `Đăng nhập: ${user.username}`,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
