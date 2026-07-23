import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import {
  LOGIN_IP_LIMIT,
  clientIpFromHeaders,
  consumeRateLimit,
} from "@/lib/rate-limit";

const { GET, POST: nextAuthPost } = handlers;

export { GET };

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);
  const limited = consumeRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts", code: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }
  return nextAuthPost(req);
}
