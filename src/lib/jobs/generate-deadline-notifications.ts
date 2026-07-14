import "dotenv/config";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
