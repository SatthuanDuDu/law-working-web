import type { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleMatterIds } from "@/lib/access";
import { endOfVietnamDayPlus } from "@/lib/datetime";

/**
 * Open tasks + plan steps that are overdue or due through end of day +3 days
 * (matches dashboard “Hạn sắp tới” window + overdue).
 */
export async function getUpcomingDueCount(userId: string, role: Role) {
  const now = new Date();
  const soonEnd = endOfVietnamDayPlus(3, now);
  const matterIds = await getAccessibleMatterIds(userId, role);

  const openTaskWhere = {
    assigneeId: userId,
    status: { in: ["TODO", "IN_PROGRESS"] satisfies TaskStatus[] },
    dueDate: { lte: soonEnd },
  };

  const [taskCount, planCount] = await Promise.all([
    prisma.task.count({ where: openTaskWhere }),
    prisma.matterPlanStep.count({
      where: {
        dueAt: { not: null, lte: soonEnd },
        status: { not: "DONE" },
        ...(matterIds ? { matterId: { in: matterIds } } : {}),
      },
    }),
  ]);

  return taskCount + planCount;
}
