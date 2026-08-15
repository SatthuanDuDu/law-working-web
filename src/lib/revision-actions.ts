"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import {
  serializeRevision,
  type RevisionListItem,
} from "@/lib/revisions";

const revisionInclude = {
  changedBy: { select: { name: true } },
} as const;

export async function listRevisionsAction(
  entityType: string,
  entityId: string,
  opts?: { take?: number },
) {
  await requireAuth();
  if (!entityType?.trim() || !entityId?.trim()) {
    return { revisions: [] as RevisionListItem[] };
  }

  const take = Math.min(Math.max(opts?.take ?? 100, 1), 500);
  const rows = await prisma.entityRevision.findMany({
    where: { entityType, entityId },
    include: revisionInclude,
    orderBy: { version: "desc" },
    take,
  });

  return { revisions: rows.map(serializeRevision) };
}

export async function listRevisionsAdminAction(filters?: {
  entityType?: string | null;
  entityId?: string | null;
  changedById?: string | null;
  from?: string | null;
  to?: string | null;
  take?: number;
}) {
  await requireRole(["ADMIN"]);
  const take = Math.min(Math.max(filters?.take ?? 100, 1), 500);
  const where: Prisma.EntityRevisionWhereInput = {};

  if (filters?.entityType?.trim()) {
    where.entityType = filters.entityType.trim();
  }
  if (filters?.entityId?.trim()) {
    where.entityId = filters.entityId.trim();
  }
  if (filters?.changedById?.trim()) {
    where.changedById = filters.changedById.trim();
  }
  if (filters?.from || filters?.to) {
    where.createdAt = {};
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
      where.createdAt.gte = new Date(`${filters.from}T00:00:00.000`);
    }
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
      where.createdAt.lte = new Date(`${filters.to}T23:59:59.999`);
    }
  }

  const rows = await prisma.entityRevision.findMany({
    where,
    include: revisionInclude,
    orderBy: { createdAt: "desc" },
    take,
  });

  return { revisions: rows.map(serializeRevision) };
}
