import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export async function createAuditLog(params: {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
    },
  });
}
