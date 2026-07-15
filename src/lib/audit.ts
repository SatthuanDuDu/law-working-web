import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export async function createAuditLog(params: {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  details?: string;
}) {
  try {
    let userId = params.userId ?? null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) userId = null;
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details,
      },
    });
  } catch (error) {
    // Audit must never block the main business action.
    console.error("createAuditLog failed:", error);
  }
}
