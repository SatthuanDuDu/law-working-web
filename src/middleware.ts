import { auth } from "@/lib/auth";

export { auth as middleware };

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/matters/:path*",
    "/clients/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/workload/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
