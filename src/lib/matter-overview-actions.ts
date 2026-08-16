"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { getLabelMaps } from "@/i18n/server-labels";
import {
  buildMatterOverview,
  type MatterOverviewModel,
} from "@/lib/matter-overview-model";

export async function getMatterOverviewAction(
  matterId: string,
): Promise<{ error?: string; overview?: MatterOverviewModel }> {
  const user = await requireAuth();
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: "Không có quyền xem vụ việc này" };
  }

  const [matter, labels] = await Promise.all([
    prisma.matter.findUnique({
      where: { id: matterId },
      include: {
        client: true,
        leadLawyer: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
        planSteps: {
          include: {
            workType: { select: { name: true } },
            assignees: {
              include: { user: { select: { name: true } } },
            },
            comments: {
              include: {
                author: { select: { name: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        comments: {
          where: { matterPlanStepId: null },
          include: {
            author: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getLabelMaps(),
  ]);

  if (!matter || matter.deletedAt) {
    return { error: "Không tìm thấy vụ việc" };
  }

  const overview = buildMatterOverview({
    matter,
    planSteps: matter.planSteps,
    generalComments: matter.comments,
    labels: {
      matterStatus: labels.matterStatus,
      planStepStatus: labels.planStepStatus,
      taskPriority: labels.taskPriority,
    },
  });

  return { overview };
}
