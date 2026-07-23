import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/matters/:path*",
    "/clients/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/workload/:path*",
    "/expenses/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/chat",
    "/chat/:path*",
    "/login",
    "/api/:path*",
  ],
};
