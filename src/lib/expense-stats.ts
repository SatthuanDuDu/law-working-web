import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  differenceInCalendarDays,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import type { ExpenseType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ExpenseStatsKpis = {
  totalVnd: string;
  count: number;
  avgVnd: string;
  mattersTouched: number;
  topType: ExpenseType | null;
  topTypeCustomLabel: string | null;
  topTypePct: number;
};

export type ExpenseTypeStat = {
  key: string;
  type: ExpenseType;
  customTypeLabel: string | null;
  amountVnd: string;
  count: number;
  pct: number;
};

export type ExpenseMatterStat = {
  matterId: string;
  code: string;
  title: string;
  amountVnd: string;
  count: number;
  pct: number;
};

export type ExpenseSeriesPoint = {
  date: string;
  amountVnd: string;
  count: number;
};

export type ExpenseStatsDto = {
  from: string;
  to: string;
  kpis: ExpenseStatsKpis;
  byType: ExpenseTypeStat[];
  byMatter: ExpenseMatterStat[];
  series: ExpenseSeriesPoint[];
  bucket: "day" | "week";
};

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inclusive calendar range; defaults to current month (local). */
export function resolveExpenseStatsRange(searchParams: {
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

function typeKey(type: ExpenseType, customTypeLabel: string | null) {
  if (type === "OTHER" && customTypeLabel?.trim()) {
    return `OTHER:${customTypeLabel.trim().toLowerCase()}`;
  }
  return type;
}

export async function getExpenseStats(range: {
  from: Date;
  to: Date;
}): Promise<ExpenseStatsDto> {
  const fromIso = toIsoDate(range.from);
  const toIso = toIsoDate(range.to);

  const rows = await prisma.matterExpense.findMany({
    where: {
      createdAt: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      type: true,
      customTypeLabel: true,
      amountVnd: true,
      createdAt: true,
      matterId: true,
      matter: { select: { code: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const ZERO = BigInt(0);
  const PCT_SCALE = BigInt(10000);
  let total = ZERO;
  const typeMap = new Map<
    string,
    { type: ExpenseType; customTypeLabel: string | null; amount: bigint; count: number }
  >();
  const matterMap = new Map<
    string,
    { code: string; title: string; amount: bigint; count: number }
  >();

  for (const row of rows) {
    const amount = row.amountVnd;
    total += amount;

    const key = typeKey(row.type, row.customTypeLabel);
    const existingType = typeMap.get(key);
    if (existingType) {
      existingType.amount += amount;
      existingType.count += 1;
    } else {
      typeMap.set(key, {
        type: row.type,
        customTypeLabel:
          row.type === "OTHER" ? row.customTypeLabel?.trim() || null : null,
        amount,
        count: 1,
      });
    }

    const existingMatter = matterMap.get(row.matterId);
    if (existingMatter) {
      existingMatter.amount += amount;
      existingMatter.count += 1;
    } else {
      matterMap.set(row.matterId, {
        code: row.matter.code,
        title: row.matter.title,
        amount,
        count: 1,
      });
    }
  }

  const count = rows.length;
  const avg = count > 0 ? total / BigInt(count) : ZERO;

  const byType = [...typeMap.entries()]
    .map(([key, value]) => ({
      key,
      type: value.type,
      customTypeLabel: value.customTypeLabel,
      amountVnd: value.amount.toString(),
      count: value.count,
      pct: total > ZERO ? Number((value.amount * PCT_SCALE) / total) / 100 : 0,
    }))
    .sort((a, b) => {
      const diff = BigInt(b.amountVnd) - BigInt(a.amountVnd);
      if (diff > ZERO) return 1;
      if (diff < ZERO) return -1;
      return b.count - a.count;
    });

  const byMatter = [...matterMap.entries()]
    .map(([matterId, value]) => ({
      matterId,
      code: value.code,
      title: value.title,
      amountVnd: value.amount.toString(),
      count: value.count,
      pct: total > ZERO ? Number((value.amount * PCT_SCALE) / total) / 100 : 0,
    }))
    .sort((a, b) => {
      const diff = BigInt(b.amountVnd) - BigInt(a.amountVnd);
      if (diff > ZERO) return 1;
      if (diff < ZERO) return -1;
      return a.code.localeCompare(b.code);
    });

  const top = byType[0] ?? null;
  const daySpan = differenceInCalendarDays(range.to, range.from) + 1;
  const bucket: "day" | "week" = daySpan > 60 ? "week" : "day";

  const seriesMap = new Map<string, { amount: bigint; count: number }>();

  if (bucket === "day") {
    for (const day of eachDayOfInterval({ start: range.from, end: range.to })) {
      seriesMap.set(toIsoDate(day), { amount: ZERO, count: 0 });
    }
    for (const row of rows) {
      const key = toIsoDate(row.createdAt);
      const slot = seriesMap.get(key) ?? { amount: ZERO, count: 0 };
      slot.amount += row.amountVnd;
      slot.count += 1;
      seriesMap.set(key, slot);
    }
  } else {
    for (const row of rows) {
      const weekStart = startOfWeek(row.createdAt, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(row.createdAt, { weekStartsOn: 1 });
      const key = `${toIsoDate(weekStart)}_${toIsoDate(weekEnd)}`;
      const slot = seriesMap.get(key) ?? { amount: ZERO, count: 0 };
      slot.amount += row.amountVnd;
      slot.count += 1;
      seriesMap.set(key, slot);
    }
  }

  const series = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: bucket === "week" ? date.split("_")[0]! : date,
      amountVnd: value.amount.toString(),
      count: value.count,
    }));

  return {
    from: fromIso,
    to: toIso,
    kpis: {
      totalVnd: total.toString(),
      count,
      avgVnd: avg.toString(),
      mattersTouched: matterMap.size,
      topType: top?.type ?? null,
      topTypeCustomLabel: top?.customTypeLabel ?? null,
      topTypePct: top?.pct ?? 0,
    },
    byType,
    byMatter,
    series,
    bucket,
  };
}
