import { NextResponse } from "next/server";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { notifyUsersPush } from "@/lib/web-push";

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

  const now = new Date();
  const windowEnd = endOfDay(addDays(now, 3));

  const dueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lte: windowEnd },
      status: { in: ["TODO", "IN_PROGRESS"] },
      reminderSentAt: null,
    },
  });

  let created = 0;

  for (const task of dueTasks) {
    const due = task.dueDate!;
    const overdue = due < startOfDay(now);
    const title = overdue ? "Task đã quá hạn" : "Task sắp đến hạn";
    const message = overdue
      ? `"${task.title}" đã quá hạn.`
      : `"${task.title}" sẽ đến hạn trong vài ngày tới.`;
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: "TASK_DUE",
        title,
        message,
        link: "/tasks",
      },
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { reminderSentAt: now },
    });
    void notifyUsersPush(task.assigneeId, {
      title,
      body: message,
      url: "/tasks",
      tag: `task-due-${task.id}`,
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
