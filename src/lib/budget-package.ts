import type { BudgetPackage, BudgetPackageStatus } from "@prisma/client";

/** remaining = allocated - spent - returned (never negative for display). */
export function packageRemainingVnd(pkg: {
  allocatedVnd: bigint;
  spentVnd: bigint;
  returnedVnd: bigint;
}): bigint {
  const rem = pkg.allocatedVnd - pkg.spentVnd - pkg.returnedVnd;
  return rem < BigInt(0) ? BigInt(0) : rem;
}

export function isPackageSpendable(status: BudgetPackageStatus): boolean {
  return status === "OPEN";
}

export type BudgetPackageDto = {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  createdById: string;
  createdByName: string;
  status: BudgetPackageStatus;
  matterId: string | null;
  matterCode: string | null;
  matterTitle: string | null;
  note: string | null;
  allocatedVnd: string;
  spentVnd: string;
  returnedVnd: string;
  remainingVnd: string;
  settleMode: string | null;
  carryToPackageId: string | null;
  settleRequestedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeBudgetPackage(
  pkg: BudgetPackage & {
    owner: { name: string };
    createdBy: { name: string };
    matter?: { code: string; title: string } | null;
  },
): BudgetPackageDto {
  const remaining = packageRemainingVnd(pkg);
  return {
    id: pkg.id,
    name: pkg.name,
    ownerUserId: pkg.ownerUserId,
    ownerName: pkg.owner.name,
    createdById: pkg.createdById,
    createdByName: pkg.createdBy.name,
    status: pkg.status,
    matterId: pkg.matterId,
    matterCode: pkg.matter?.code ?? null,
    matterTitle: pkg.matter?.title ?? null,
    note: pkg.note,
    allocatedVnd: pkg.allocatedVnd.toString(),
    spentVnd: pkg.spentVnd.toString(),
    returnedVnd: pkg.returnedVnd.toString(),
    remainingVnd: remaining.toString(),
    settleMode: pkg.settleMode,
    carryToPackageId: pkg.carryToPackageId,
    settleRequestedAt: pkg.settleRequestedAt?.toISOString() ?? null,
    closedAt: pkg.closedAt?.toISOString() ?? null,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}

export const budgetPackageInclude = {
  owner: { select: { name: true } },
  createdBy: { select: { name: true } },
  matter: { select: { code: true, title: true } },
} as const;

/** Apply dual-confirmed allocate/top-up into package totals (inside tx). */
export async function applyPackageFundingInTx(
  db: import("@prisma/client").Prisma.TransactionClient,
  params: { budgetPackageId: string; amountVnd: bigint },
) {
  const pkg = await db.budgetPackage.findUnique({
    where: { id: params.budgetPackageId },
  });
  if (!pkg) throw new Error("PACKAGE_NOT_FOUND");
  if (pkg.status === "CLOSED" || pkg.status === "CANCELLED") {
    throw new Error("PACKAGE_CLOSED");
  }

  await db.budgetPackage.update({
    where: { id: pkg.id },
    data: {
      allocatedVnd: { increment: params.amountVnd },
      status: pkg.status === "PENDING_FUNDING" ? "OPEN" : pkg.status,
    },
  });
}

/**
 * If an unfunded PENDING_FUNDING package loses its allocate confirmation,
 * cancel the empty package shell.
 */
export async function cancelPackageIfUnfundedInTx(
  db: import("@prisma/client").Prisma.TransactionClient,
  budgetPackageId: string | null | undefined,
) {
  if (!budgetPackageId) return;
  const pkg = await db.budgetPackage.findUnique({
    where: { id: budgetPackageId },
  });
  if (!pkg) return;
  if (pkg.status !== "PENDING_FUNDING") return;
  if (pkg.allocatedVnd !== BigInt(0)) return;

  await db.budgetPackage.update({
    where: { id: pkg.id },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
}
