import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getUrgentReminders } from "@/lib/urgent-reminders";

/**
 * Lightweight shell data for header badges.
 * Fetched client-side so dashboard layout stays fast.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [unreadCount, urgentReminders] = await Promise.all([
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
    getUrgentReminders(user.id, user.role),
  ]);

  return NextResponse.json(
    { unreadCount, urgentReminders },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
