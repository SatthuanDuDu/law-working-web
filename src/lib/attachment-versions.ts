import { prisma } from "@/lib/prisma";

/** Attach versionCount for each latest attachment row (same versionGroupId). */
export async function attachVersionCounts<
  T extends { versionGroupId: string },
>(files: T[]): Promise<(T & { versionCount: number })[]> {
  const groupIds = [...new Set(files.map((f) => f.versionGroupId))];
  if (groupIds.length === 0) return files.map((f) => ({ ...f, versionCount: 1 }));

  const rows = await prisma.attachment.groupBy({
    by: ["versionGroupId"],
    where: { versionGroupId: { in: groupIds } },
    _count: { _all: true },
  });
  const countByGroup = new Map(
    rows.map((row) => [row.versionGroupId, row._count._all]),
  );

  return files.map((f) => ({
    ...f,
    versionCount: countByGroup.get(f.versionGroupId) ?? 1,
  }));
}
