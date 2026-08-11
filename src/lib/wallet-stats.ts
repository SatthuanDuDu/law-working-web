import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureStaffWallet } from "@/lib/wallet";
import { canManageWalletUser, type SessionUser } from "@/lib/permissions";
import type { Role } from "@prisma/client";

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

export type CashflowStatsDto = {
  from: string;
  to: string;
  totalCreditedVnd: string;
  totalDebitedVnd: string;
  creditCount: number;
  debitCount: number;
  walletsTotalBalanceVnd: string;
  byCategory: WalletCategoryStat[];
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

  const baseDebit = {
    direction: "DEBIT" as const,
    legacyImported: false,
    createdAt,
    ...walletUserFilter,
  };
  const baseCredit = {
    direction: "CREDIT" as const,
    legacyImported: false,
    createdAt,
    ...walletUserFilter,
  };

  const [creditAgg, debitAgg, byCategory] = await Promise.all([
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

  return {
    from: toIsoDate(range.from),
    to: toIsoDate(range.to),
    totalCreditedVnd: totalCredit.toString(),
    totalDebitedVnd: totalDebit.toString(),
    creditCount: creditAgg._count,
    debitCount: debitAgg._count,
    walletsTotalBalanceVnd: walletsTotal.toString(),
    byCategory: byCategoryStats,
    byUser: walletsFresh.map((w) => ({
      userId: w.userId,
      name: w.user.name,
      username: w.user.username,
      role: w.user.role as Role,
      balanceVnd: w.balanceVnd.toString(),
    })),
  };
}
