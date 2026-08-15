import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { BudgetPackageStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureStaffWallet } from "@/lib/wallet";
import { canManageWalletUser, type SessionUser } from "@/lib/permissions";
import { packageRemainingVnd } from "@/lib/budget-package";

/** Internal transfers — exclude from cashflow credit/debit totals. */
const CARRY_KINDS = ["CARRY_OUT", "CARRY_IN"] as const;

export type WalletUserBalance = {
  userId: string;
  name: string;
  username: string;
  role: string;
  balanceVnd: string;
};

export type WalletCategoryStat = {
  spendCategoryId: string;
  name: string;
  amountVnd: string;
  count: number;
  pct: number;
};

export type WalletPackageStat = {
  packageId: string;
  name: string;
  ownerName: string;
  status: BudgetPackageStatus;
  allocatedVnd: string;
  spentVnd: string;
  remainingVnd: string;
  returnedVnd: string;
  pctSpent: number;
  matterCode: string | null;
};

export type CashflowStatsDto = {
  from: string;
  to: string;
  totalCreditedVnd: string;
  totalDebitedVnd: string;
  creditCount: number;
  debitCount: number;
  walletsTotalBalanceVnd: string;
  /** Sum of CLIENT_RECEIPT credits (approx. client cash held). */
  clientCashHeldVnd: string;
  /** Sum of package remaining for packages in range / filter. */
  packagesRemainingVnd: string;
  packagesAllocatedVnd: string;
  packagesSpentVnd: string;
  openPackageCount: number;
  pendingTopupCount: number;
  byCategory: WalletCategoryStat[];
  byPackage: WalletPackageStat[];
  byUser: WalletUserBalance[];
};

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveCashflowRange(searchParams: {
  from?: string | null;
  to?: string | null;
}): { from: Date; to: Date; fromIso: string; toIso: string } {
  const now = new Date();
  const parsedFrom = parseIsoDate(searchParams.from ?? undefined);
  const parsedTo = parseIsoDate(searchParams.to ?? undefined);

  let from = parsedFrom ? startOfDay(parsedFrom) : startOfMonth(now);
  let to = parsedTo ? endOfDay(parsedTo) : endOfMonth(now);

  if (from.getTime() > to.getTime()) {
    const swap = from;
    from = startOfDay(to);
    to = endOfDay(swap);
  }

  return {
    from,
    to,
    fromIso: toIsoDate(from),
    toIso: toIsoDate(to),
  };
}

export async function getCashflowStats(
  range: {
    from: Date;
    to: Date;
  },
  actor?: Pick<SessionUser, "id" | "role">,
  options?: {
    packageStatus?: BudgetPackageStatus | "ALL" | "ACTIVE" | null;
  },
): Promise<CashflowStatsDto> {
  const createdAt = { gte: range.from, lte: range.to };

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });
  const allowedUserIds = actor
    ? activeUsers.filter((u) => canManageWalletUser(actor, u)).map((u) => u.id)
    : activeUsers.map((u) => u.id);

  const walletUserFilter =
    allowedUserIds.length > 0
      ? { walletUserId: { in: allowedUserIds } }
      : { walletUserId: { in: ["__none__"] } };

  const notCarry = { kind: { notIn: [...CARRY_KINDS] } };

  const baseDebit = {
    direction: "DEBIT" as const,
    legacyImported: false,
    createdAt,
    ...walletUserFilter,
    ...notCarry,
  };
  const baseCredit = {
    direction: "CREDIT" as const,
    legacyImported: false,
    createdAt,
    ...walletUserFilter,
    ...notCarry,
  };

  const packageStatusFilter = options?.packageStatus;
  const packageWhereStatus =
    packageStatusFilter === "ACTIVE"
      ? { status: { in: ["PENDING_FUNDING", "OPEN", "PENDING_SETTLE"] as BudgetPackageStatus[] } }
      : packageStatusFilter && packageStatusFilter !== "ALL"
        ? { status: packageStatusFilter }
        : {};

  const [
    creditAgg,
    debitAgg,
    byCategory,
    clientCashAgg,
    packagesInRange,
    openPackageCount,
    pendingTopupCount,
  ] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: baseCredit,
      _sum: { amountVnd: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: baseDebit,
      _sum: { amountVnd: true },
      _count: true,
    }),
    prisma.walletTransaction.groupBy({
      by: ["spendCategoryId"],
      where: { ...baseDebit, spendCategoryId: { not: null } },
      _sum: { amountVnd: true },
      _count: true,
    }),
    prisma.walletTransaction.aggregate({
      where: {
        direction: "CREDIT",
        kind: "CLIENT_RECEIPT",
        legacyImported: false,
        ...walletUserFilter,
      },
      _sum: { amountVnd: true },
    }),
    prisma.budgetPackage.findMany({
      where: {
        ownerUserId: { in: allowedUserIds.length ? allowedUserIds : ["__none__"] },
        createdAt,
        ...packageWhereStatus,
      },
      include: {
        owner: { select: { name: true } },
        matter: { select: { code: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.budgetPackage.count({
      where: {
        ownerUserId: { in: allowedUserIds.length ? allowedUserIds : ["__none__"] },
        status: { in: ["PENDING_FUNDING", "OPEN", "PENDING_SETTLE"] },
      },
    }),
    prisma.budgetTopupRequest.count({
      where: {
        status: "PENDING",
        package: {
          ownerUserId: { in: allowedUserIds.length ? allowedUserIds : ["__none__"] },
        },
      },
    }),
  ]);

  await Promise.all(allowedUserIds.map((id) => ensureStaffWallet(prisma, id)));

  const walletsFresh = await prisma.staffWallet.findMany({
    where: { userId: { in: allowedUserIds } },
    select: {
      userId: true,
      balanceVnd: true,
      user: { select: { name: true, username: true, role: true } },
    },
    orderBy: [{ balanceVnd: "desc" }, { user: { name: "asc" } }],
  });

  const categoryIds = byCategory
    .map((r) => r.spendCategoryId)
    .filter((id): id is string => Boolean(id));
  const categoryRows = categoryIds.length
    ? await prisma.spendCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));

  const totalDebit = debitAgg._sum.amountVnd ?? BigInt(0);
  const totalCredit = creditAgg._sum.amountVnd ?? BigInt(0);
  const walletsTotal = walletsFresh.reduce(
    (acc, w) => acc + w.balanceVnd,
    BigInt(0),
  );
  const clientCashHeld = clientCashAgg._sum.amountVnd ?? BigInt(0);

  const byCategoryStats: WalletCategoryStat[] = byCategory
    .filter((row) => row.spendCategoryId != null)
    .map((row) => {
      const amount = row._sum.amountVnd ?? BigInt(0);
      const pct =
        totalDebit > BigInt(0)
          ? Number((amount * BigInt(10000)) / totalDebit) / 100
          : 0;
      const id = row.spendCategoryId as string;
      return {
        spendCategoryId: id,
        name: nameById[id] ?? id,
        amountVnd: amount.toString(),
        count: row._count,
        pct,
      };
    })
    .sort((a, b) => Number(BigInt(b.amountVnd) - BigInt(a.amountVnd)));

  let packagesAllocated = BigInt(0);
  let packagesSpent = BigInt(0);
  let packagesRemaining = BigInt(0);

  const byPackageStats: WalletPackageStat[] = packagesInRange.map((pkg) => {
    const remaining = packageRemainingVnd(pkg);
    packagesAllocated += pkg.allocatedVnd;
    packagesSpent += pkg.spentVnd;
    packagesRemaining += remaining;
    const pctSpent =
      pkg.allocatedVnd > BigInt(0)
        ? Number((pkg.spentVnd * BigInt(10000)) / pkg.allocatedVnd) / 100
        : 0;
    return {
      packageId: pkg.id,
      name: pkg.name,
      ownerName: pkg.owner.name,
      status: pkg.status,
      allocatedVnd: pkg.allocatedVnd.toString(),
      spentVnd: pkg.spentVnd.toString(),
      remainingVnd: remaining.toString(),
      returnedVnd: pkg.returnedVnd.toString(),
      pctSpent: Math.min(100, pctSpent),
      matterCode: pkg.matter?.code ?? null,
    };
  });

  return {
    from: toIsoDate(range.from),
    to: toIsoDate(range.to),
    totalCreditedVnd: totalCredit.toString(),
    totalDebitedVnd: totalDebit.toString(),
    creditCount: creditAgg._count,
    debitCount: debitAgg._count,
    walletsTotalBalanceVnd: walletsTotal.toString(),
    clientCashHeldVnd: clientCashHeld.toString(),
    packagesRemainingVnd: packagesRemaining.toString(),
    packagesAllocatedVnd: packagesAllocated.toString(),
    packagesSpentVnd: packagesSpent.toString(),
    openPackageCount,
    pendingTopupCount,
    byCategory: byCategoryStats,
    byPackage: byPackageStats,
    byUser: walletsFresh.map((w) => ({
      userId: w.userId,
      name: w.user.name,
      username: w.user.username,
      role: w.user.role as Role,
      balanceVnd: w.balanceVnd.toString(),
    })),
  };
}
