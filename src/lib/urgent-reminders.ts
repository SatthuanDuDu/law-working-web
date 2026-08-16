import { addHours, subHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAccessibleMatterIds } from "@/lib/access";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";
import { VIETNAM_TIMEZONE } from "@/lib/datetime";
import type { Role } from "@prisma/client";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";

function formatStartTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Reminders for NOT_STARTED / IN_PROGRESS plans only when the
 * countdown to dueAt (or startedAt if no due) is within 2 hours.
 */
export async function getUrgentReminders(
  userId: string,
  role: Role,
): Promise<UrgentReminderItem[]> {
  const now = new Date();
  const withinTwoHours = addHours(now, 2);
  const twoHoursAgo = subHours(now, 2);
  const matterIds = await getAccessibleMatterIds(userId, role);

  const steps = await prisma.matterPlanStep.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      matter: { deletedAt: null },
      AND: [
        {
          OR: [
            {
              dueAt: {
                gte: now,
                lte: withinTwoHours,
              },
            },
            {
              dueAt: null,
              startedAt: {
                not: null,
                gte: twoHoursAgo,
                lte: withinTwoHours,
              },
            },
          ],
        },
        {
          OR: [
            { assignees: { some: { userId } } },
            {
              assignees: { none: {} },
              ...(matterIds ? { matterId: { in: matterIds } } : {}),
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      startedAt: true,
      dueAt: true,
      matterId: true,
    },
    orderBy: [{ dueAt: "asc" }, { startedAt: "asc" }],
    take: 40,
  });

  const nowMs = now.getTime();

  const planItems = steps
    .filter((step) => {
      const startsAt = step.startedAt ?? step.dueAt;
      if (!startsAt) return false;
      return isUrgentReminderActive(
        nowMs,
        startsAt.toISOString(),
        step.dueAt?.toISOString() ?? null,
      );
    })
    .map((step) => {
      const startsAt = step.startedAt ?? step.dueAt!;
      return {
        id: step.id,
        title: step.title,
        href: `/matters/${step.matterId}/plan`,
        startsAt: startsAt.toISOString(),
        endsAt: step.dueAt?.toISOString() ?? null,
        timeLabel: formatStartTime(step.dueAt ?? startsAt),
      } satisfies UrgentReminderItem;
    });

  const personalTodos = await prisma.personalTodo.findMany({
    where: {
      ownerId: userId,
      isDone: false,
      hasTime: true,
      dueDate: {
        gte: twoHoursAgo,
        lte: withinTwoHours,
      },
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  const todoItems = personalTodos
    .filter((todo) => {
      if (!todo.dueDate) return false;
      return isUrgentReminderActive(
        nowMs,
        todo.dueDate.toISOString(),
        null,
      );
    })
    .map((todo) => {
      const due = todo.dueDate!;
      return {
        id: `todo-${todo.id}`,
        title: todo.title,
        href: "/dashboard?todo=1",
        startsAt: due.toISOString(),
        endsAt: null,
        timeLabel: formatStartTime(due),
      } satisfies UrgentReminderItem;
    });

  return [...planItems, ...todoItems]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 10);
}
