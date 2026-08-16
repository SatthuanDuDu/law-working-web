import { subHours } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { notifyUsersPush } from "@/lib/web-push";
import { endOfVietnamDayPlus, startOfVietnamDay } from "@/lib/datetime";

const DEFAULT_BATCH_SIZE = 100;

type Db = Pick<
  PrismaClient,
  "task" | "matterPlanStep" | "personalTodo" | "notification"
>;

export type DeadlineReminderResult = {
  taskReminders: number;
  planReminders: number;
  todoReminders: number;
};

/**
 * Upcoming (≤3 days) + overdue (repeat after 24h) reminders for Tasks,
 * MatterPlanSteps, and personal To-dos. Batches notification creates.
 */
export async function generateDeadlineReminders(
  db: Db,
  options?: { batchSize?: number; now?: Date },
): Promise<DeadlineReminderResult> {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const windowEnd = endOfVietnamDayPlus(3, now);
  const todayStart = startOfVietnamDay(now);
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

  const [dueTasks, dueSteps, dueTodos] = await Promise.all([
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
        OR: [...planDueWindowOr],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        matterId: true,
        assignees: { select: { userId: true } },
        matter: { select: { leadLawyerId: true } },
      },
      take: batchSize,
      orderBy: { dueAt: "asc" },
    }),
    db.personalTodo.findMany({
      where: {
        isDone: false,
        dueDate: { not: null, lte: windowEnd },
        OR: [...dueWindowOr],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        ownerId: true,
      },
      take: batchSize,
      orderBy: { dueDate: "asc" },
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
    const recipientIds = [
      ...new Set(
        step.assignees.length > 0
          ? step.assignees.map((a) => a.userId)
          : step.matter.leadLawyerId
            ? [step.matter.leadLawyerId]
            : [],
      ),
    ];
    return recipientIds.map((userId) => ({
      userId,
      type: "PLAN_DUE" as const,
      title,
      message,
      link,
      stepId: step.id,
      overdue,
    }));
  });

  const todoNotifications = dueTodos.map((todo) => {
    const due = todo.dueDate!;
    const overdue = due < todayStart;
    const title = overdue ? "To-do đã quá hạn" : "To-do sắp đến hạn";
    const message = overdue
      ? `"${todo.title}" đã quá hạn.`
      : `"${todo.title}" sẽ đến hạn trong vài ngày tới.`;
    return {
      userId: todo.ownerId,
      type: "PERSONAL_TODO_DUE" as const,
      title,
      message,
      link: "/dashboard?todo=1",
      todoId: todo.id,
    };
  });

  // Only mark steps that actually produced at least one notification.
  const notifiedStepIds = [
    ...new Set(planNotifications.map((n) => n.stepId)),
  ];

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
      where: { id: { in: notifiedStepIds } },
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

  if (todoNotifications.length > 0) {
    await db.notification.createMany({
      data: todoNotifications.map(({ userId, type, title, message, link }) => ({
        userId,
        type,
        title,
        message,
        link,
      })),
    });
    await db.personalTodo.updateMany({
      where: { id: { in: dueTodos.map((todo) => todo.id) } },
      data: { reminderSentAt: now },
    });
    for (const n of todoNotifications) {
      void notifyUsersPush(n.userId, {
        title: n.title,
        body: n.message,
        url: n.link,
        tag: `todo-due-${n.todoId}`,
      });
    }
  }

  return {
    taskReminders: taskNotifications.length,
    planReminders: planNotifications.length,
    todoReminders: todoNotifications.length,
  };
}
