import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import {
  canViewAllClients,
  canViewAllDailyLogs,
  canViewAllMatters,
} from "@/lib/permissions";

export async function getAccessibleMatterIds(userId: string, role: Role) {
  if (canViewAllMatters(role)) return null;

  const memberships = await prisma.matterMember.findMany({
    where: { userId },
    select: { matterId: true },
  });

  const ledMatters = await prisma.matter.findMany({
    where: { leadLawyerId: userId },
    select: { id: true },
  });

  return Array.from(
    new Set([
      ...memberships.map((m) => m.matterId),
      ...ledMatters.map((m) => m.id),
    ]),
  );
}

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

export function buildDailyLogWhere(userId: string, role: Role) {
  if (canViewAllDailyLogs(role)) return {};
  return { userId };
}

export async function canAccessAttachmentTarget(
  userId: string,
  role: Role,
  target: {
    matterId?: string | null;
    taskId?: string | null;
    dailyLogId?: string | null;
    clientId?: string | null;
  },
) {
  if (canViewAllMatters(role)) return true;

  if (target.matterId) {
    const matterIds = await getAccessibleMatterIds(userId, role);
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
      const matterIds = await getAccessibleMatterIds(userId, role);
      return !!matterIds?.includes(task.matterId);
    }
    return false;
  }

  if (target.dailyLogId) {
    const log = await prisma.dailyLog.findUnique({
      where: { id: target.dailyLogId },
      select: { userId: true, matterId: true },
    });
    if (!log) return false;
    if (log.userId === userId || canViewAllDailyLogs(role)) return true;
    if (log.matterId) {
      const matterIds = await getAccessibleMatterIds(userId, role);
      return !!matterIds?.includes(log.matterId);
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
