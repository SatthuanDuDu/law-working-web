import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/** Attach pathname so server layouts can resolve page meta before the shell paints. */
export default auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/matters/:path*",
    "/clients/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/workload/:path*",
    "/expenses/:path*",
    "/wallet/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/website/:path*",
    "/chat",
    "/chat/:path*",
    "/login",
    "/api/:path*",
  ],
};
