import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { notifyUsersPush } from "@/lib/web-push";

const DEFAULT_BATCH_SIZE = 100;

type Db = Pick<
  PrismaClient,
  "task" | "matterPlanStep" | "notification"
>;

export type DeadlineReminderResult = {
  taskReminders: number;
  planReminders: number;
};

/**
 * Upcoming (≤3 days) + overdue (repeat after 24h) reminders for Tasks and
 * MatterPlanSteps. Batches notification creates; caps each entity type.
 */
export async function generateDeadlineReminders(
  db: Db,
  options?: { batchSize?: number; now?: Date },
): Promise<DeadlineReminderResult> {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const windowEnd = endOfDay(addDays(now, 3));
  const todayStart = startOfDay(now);
  const reminderStaleBefore = subHours(now, 24);

  const dueWindowOr = [
    { reminderSentAt: null },
    {
      dueDate: { lt: todayStart },
      reminderSentAt: { lt: reminderStaleBefore },
    },
  ] as const;

  const planDueWindowOr = [
    { reminderSentAt: null },
    {
      dueAt: { lt: todayStart },
      reminderSentAt: { lt: reminderStaleBefore },
    },
  ] as const;

  const [dueTasks, dueSteps] = await Promise.all([
    db.task.findMany({
      where: {
        dueDate: { not: null, lte: windowEnd },
        status: { in: ["TODO", "IN_PROGRESS"] },
        OR: [...dueWindowOr],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
      },
      take: batchSize,
      orderBy: { dueDate: "asc" },
    }),
    db.matterPlanStep.findMany({
      where: {
        dueAt: { not: null, lte: windowEnd },
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        assignees: { some: {} },
        OR: [...planDueWindowOr],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        matterId: true,
        assignees: { select: { userId: true } },
      },
      take: batchSize,
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const taskNotifications = dueTasks.map((task) => {
    const due = task.dueDate!;
    const overdue = due < todayStart;
    const title = overdue ? "Task đã quá hạn" : "Task sắp đến hạn";
    const message = overdue
      ? `"${task.title}" đã quá hạn.`
      : `"${task.title}" sẽ đến hạn trong vài ngày tới.`;
    return {
      userId: task.assigneeId,
      type: "TASK_DUE" as const,
      title,
      message,
      link: "/tasks",
      taskId: task.id,
      overdue,
    };
  });

  const planNotifications = dueSteps.flatMap((step) => {
    const due = step.dueAt!;
    const overdue = due < todayStart;
    const title = overdue ? "Hạn bước kế hoạch đã quá" : "Hạn bước kế hoạch";
    const message = overdue
      ? `"${step.title}" đã quá hạn.`
      : `"${step.title}" sẽ đến hạn trong vài ngày tới.`;
    const link = `/matters/${step.matterId}/plan`;
    return step.assignees.map((a) => ({
      userId: a.userId,
      type: "PLAN_DUE" as const,
      title,
      message,
      link,
      stepId: step.id,
      overdue,
    }));
  });

  if (taskNotifications.length > 0) {
    await db.notification.createMany({
      data: taskNotifications.map(({ userId, type, title, message, link }) => ({
        userId,
        type,
        title,
        message,
        link,
      })),
    });
    await db.task.updateMany({
      where: { id: { in: dueTasks.map((t) => t.id) } },
      data: { reminderSentAt: now },
    });
    for (const n of taskNotifications) {
      void notifyUsersPush(n.userId, {
        title: n.title,
        body: n.message,
        url: n.link,
        tag: `task-due-${n.taskId}`,
      });
    }
  }

  if (planNotifications.length > 0) {
    await db.notification.createMany({
      data: planNotifications.map(({ userId, type, title, message, link }) => ({
        userId,
        type,
        title,
        message,
        link,
      })),
    });
    await db.matterPlanStep.updateMany({
      where: { id: { in: dueSteps.map((s) => s.id) } },
      data: { reminderSentAt: now },
    });
    for (const n of planNotifications) {
      void notifyUsersPush(n.userId, {
        title: n.title,
        body: n.message,
        url: n.link,
        tag: `plan-due-${n.stepId}`,
      });
    }
  }

  return {
    taskReminders: taskNotifications.length,
    planReminders: planNotifications.length,
  };
}
