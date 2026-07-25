import "dotenv/config";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

const prisma = new PrismaClient();

function ensureConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@admin.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendPush(
  userId: string,
  payload: { title: string; body: string; url: string; tag: string },
) {
  if (!ensureConfigured()) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  const body = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12 },
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error &&
          "statusCode" in error &&
          typeof (error as { statusCode: unknown }).statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
        }
      }
    }),
  );
}

async function main() {
  const now = new Date();
  const windowEnd = endOfDay(addDays(now, 3));

  const dueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lte: windowEnd },
      status: { in: ["TODO", "IN_PROGRESS"] },
      reminderSentAt: null,
    },
    include: {
      assignee: { select: { id: true, name: true } },
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

    await sendPush(task.assigneeId, {
      title,
      body: message,
      url: "/tasks",
      tag: `task-due-${task.id}`,
    }).catch(() => undefined);

    created += 1;
  }

  console.log(`Created ${created} deadline notifications.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
