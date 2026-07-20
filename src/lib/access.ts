import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import {
  canViewAllClients,
  canViewAllMatters,
} from "@/lib/permissions";

export const getAccessibleMatterIds = cache(async (userId: string, role: Role) => {
  if (canViewAllMatters(role)) return null;

  const [memberships, ledMatters] = await Promise.all([
    prisma.matterMember.findMany({
      where: { userId },
      select: { matterId: true },
    }),
    prisma.matter.findMany({
      where: { leadLawyerId: userId },
      select: { id: true },
    }),
  ]);

  return Array.from(
    new Set([
      ...memberships.map((m) => m.matterId),
      ...ledMatters.map((m) => m.id),
    ]),
  );
});

export async function getAccessibleClientIds(userId: string, role: Role) {
  if (canViewAllClients(role)) return null;

  const matterIds = await getAccessibleMatterIds(userId, role);
  if (!matterIds || matterIds.length === 0) return [];

  const matters = await prisma.matter.findMany({
    where: { id: { in: matterIds } },
    select: { clientId: true },
  });

  return Array.from(new Set(matters.map((m) => m.clientId)));
}

export async function canAccessAttachmentTarget(
  userId: string,
  role: Role,
  target: {
    matterId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
    conversationId?: string | null;
  },
) {
  if (target.conversationId) {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: target.conversationId,
          userId,
        },
      },
      select: { id: true },
    });
    return Boolean(member);
  }

  if (canViewAllMatters(role)) return true;

  const matterIds = await getAccessibleMatterIds(userId, role);

  if (target.matterId) {
    return !!matterIds?.includes(target.matterId);
  }

  if (target.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: target.taskId },
      select: { assigneeId: true, createdById: true, matterId: true },
    });
    if (!task) return false;
    if (task.assigneeId === userId || task.createdById === userId) return true;
    if (task.matterId) {
      return !!matterIds?.includes(task.matterId);
    }
    return false;
  }

  if (target.clientId) {
    const clientIds = await getAccessibleClientIds(userId, role);
    if (clientIds === null) return true;
    return clientIds.includes(target.clientId);
  }

  return false;
}

export async function assertMatterNotArchived(matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { status: true },
  });
  if (!matter) return { error: "Không tìm thấy vụ việc" as const };
  if (matter.status === "ARCHIVED") {
    return {
      error: "Vụ việc đã lưu trữ — chỉ được xem, không thể chỉnh sửa" as const,
    };
  }
  return { error: null };
}
