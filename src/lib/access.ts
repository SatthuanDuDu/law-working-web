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
      where: { userId, matter: { deletedAt: null } },
      select: { matterId: true },
    }),
    prisma.matter.findMany({
      where: { leadLawyerId: userId, deletedAt: null },
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
    where: {
      id: { in: matterIds },
      deletedAt: null,
      client: { deletedAt: null },
    },
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

  if (target.matterId) {
    const matter = await prisma.matter.findFirst({
      where: { id: target.matterId, deletedAt: null },
      select: { id: true },
    });
    if (!matter) return false;
    if (canViewAllMatters(role)) return true;
    const matterIds = await getAccessibleMatterIds(userId, role);
    return !!matterIds?.includes(target.matterId);
  }

  if (canViewAllMatters(role)) {
    if (target.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: target.clientId, deletedAt: null },
        select: { id: true },
      });
      return Boolean(client);
    }
    return true;
  }

  const matterIds = await getAccessibleMatterIds(userId, role);

  if (target.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: target.taskId },
      select: { assigneeId: true, createdById: true, matterId: true },
    });
    if (!task) return false;
    if (task.assigneeId === userId || task.createdById === userId) return true;
    if (task.matterId) {
      const matter = await prisma.matter.findFirst({
        where: { id: task.matterId, deletedAt: null },
        select: { id: true },
      });
      if (!matter) return false;
      return !!matterIds?.includes(task.matterId);
    }
    return false;
  }

  if (target.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: target.clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) return false;
    const clientIds = await getAccessibleClientIds(userId, role);
    if (clientIds === null) return true;
    return clientIds.includes(target.clientId);
  }

  return false;
}

export async function assertMatterNotArchived(matterId: string) {
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, deletedAt: null },
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
