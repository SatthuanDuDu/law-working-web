import { addDays, endOfDay, startOfDay } from "date-fns";
import type { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleMatterIds } from "@/lib/access";

/** Open tasks + plan steps due from today through end of day +3 days (dashboard window). */
export async function getUpcomingDueCount(userId: string, role: Role) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const soonEnd = endOfDay(addDays(now, 3));
  const matterIds = await getAccessibleMatterIds(userId, role);

  const openTaskWhere = {
    assigneeId: userId,
    status: { in: ["TODO", "IN_PROGRESS"] satisfies TaskStatus[] },
    dueDate: { gte: todayStart, lte: soonEnd },
  };

  const [taskCount, planCount] = await Promise.all([
    prisma.task.count({ where: openTaskWhere }),
    prisma.matterPlanStep.count({
      where: {
        dueAt: { gte: todayStart, lte: soonEnd },
        status: { not: "DONE" },
        ...(matterIds ? { matterId: { in: matterIds } } : {}),
      },
    }),
  ]);

  return taskCount + planCount;
}
