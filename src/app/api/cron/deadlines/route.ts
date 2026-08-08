import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDeadlineReminders } from "@/lib/deadline-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateDeadlineReminders(prisma);
  const created = result.taskReminders + result.planReminders;

  return NextResponse.json({ ok: true, created, ...result });
}
