import { addHours, subHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAccessibleMatterIds } from "@/lib/access";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";
import type { Role } from "@prisma/client";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";

function formatStartTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Reminders for NOT_STARTED / IN_PROGRESS plans:
 * from 2h before startedAt until dueAt ends.
 */
export async function getUrgentReminders(
  userId: string,
  role: Role,
): Promise<UrgentReminderItem[]> {
  const now = new Date();
  const withinTwoHours = addHours(now, 2);
  const earliestStart = subHours(now, 24 * 14);
  const matterIds = await getAccessibleMatterIds(userId, role);

  const steps = await prisma.matterPlanStep.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      startedAt: {
        not: null,
        lte: withinTwoHours,
        gte: earliestStart,
      },
      ...(matterIds ? { matterId: { in: matterIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      startedAt: true,
      dueAt: true,
      matterId: true,
    },
    orderBy: { startedAt: "asc" },
    take: 40,
  });

  const nowMs = now.getTime();

  return steps
    .filter(
      (step): step is typeof step & { startedAt: Date } => step.startedAt != null,
    )
    .filter((step) =>
      isUrgentReminderActive(
        nowMs,
        step.startedAt.toISOString(),
        step.dueAt?.toISOString() ?? null,
      ),
    )
    .slice(0, 10)
    .map((step) => ({
      id: step.id,
      title: step.title,
      href: `/matters/${step.matterId}/plan`,
      startsAt: step.startedAt.toISOString(),
      endsAt: step.dueAt?.toISOString() ?? null,
      timeLabel: formatStartTime(step.startedAt),
    }));
}
