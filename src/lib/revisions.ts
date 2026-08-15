import type { Prisma, RevisionSource } from "@prisma/client";

export type RevisionChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

export type RevisionFieldSpec<T> = {
  field: keyof T & string;
  label: string;
  format?: (value: unknown) => string;
};

function defaultFormat(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Compare before/after objects using field specs; only changed fields are returned. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  specs: RevisionFieldSpec<T>[],
): RevisionChange[] {
  const changes: RevisionChange[] = [];
  for (const spec of specs) {
    const format = spec.format ?? defaultFormat;
    const from = format(before[spec.field]);
    const to = format(after[spec.field]);
    if (from === to) continue;
    changes.push({
      field: spec.field,
      label: spec.label,
      from,
      to,
    });
  }
  return changes;
}

export type RecordRevisionParams = {
  entityType: string;
  entityId: string;
  changedById?: string | null;
  justification?: string | null;
  source: RevisionSource;
  changes: RevisionChange[];
};

/** Insert EntityRevision with next version inside an open transaction. Skips if changes empty. */
export async function recordRevision(
  db: Prisma.TransactionClient,
  params: RecordRevisionParams,
): Promise<{ id: string; version: number } | null> {
  if (!params.changes.length) return null;

  const agg = await db.entityRevision.aggregate({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
    },
    _max: { version: true },
  });
  const version = (agg._max.version ?? 0) + 1;

  const row = await db.entityRevision.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      version,
      justification: params.justification?.trim() || null,
      source: params.source,
      changedById: params.changedById ?? null,
      changes: params.changes,
    },
    select: { id: true, version: true },
  });

  return row;
}

export type RevisionListItem = {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  justification: string | null;
  source: RevisionSource;
  changes: RevisionChange[];
  createdAt: string;
  changedById: string | null;
  changedByName: string | null;
};

export function serializeRevision(row: {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  justification: string | null;
  source: RevisionSource;
  changes: Prisma.JsonValue;
  createdAt: Date;
  changedById: string | null;
  changedBy: { name: string } | null;
}): RevisionListItem {
  const changes = Array.isArray(row.changes)
    ? (row.changes as RevisionChange[])
    : [];
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    version: row.version,
    justification: row.justification,
    source: row.source,
    changes,
    createdAt: row.createdAt.toISOString(),
    changedById: row.changedById,
    changedByName: row.changedBy?.name ?? null,
  };
}

/**
 * Parse justification from FormData.
 * FORM requires at least 3 characters; QUICK allows empty.
 */
export function parseJustification(
  formData: FormData,
  source: RevisionSource,
): { justification: string | null } | { error: "justificationRequired" } {
  const raw = String(formData.get("justification") ?? "").trim();
  if (source === "FORM") {
    if (raw.length < 3) return { error: "justificationRequired" };
    return { justification: raw };
  }
  return { justification: raw.length > 0 ? raw : null };
}
