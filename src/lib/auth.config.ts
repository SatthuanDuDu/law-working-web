import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no Prisma / bcrypt).
 * Used by middleware to stay under Vercel Hobby 1MB limit.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        // Redirect using the request host — never AUTH_URL — so a shell/Vercel
        // AUTH_URL leftover cannot send local /dashboard to production login.
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
        return Response.redirect(loginUrl);
      }

      return true;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        const target = new URL(url);
        // Logout must land on /login on the host the user is actually using
        // (AUTH_URL on Vercel may point at a stale deployment alias).
        if (target.pathname === "/login") return target.toString();
        if (target.origin === baseUrl) return target.toString();
      } catch {
        // fall through
      }

      return baseUrl;
    },
  },
} satisfies NextAuthConfig;
