"use client";

import {
  Banknote,
  Hash,
  Layers,
  Scale,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import type { ExpenseStatsKpis } from "@/lib/expense-stats";
import type { ExpenseType } from "@prisma/client";

function formatVnd(amount: string) {
  const digits = amount.replace(/\D/g, "");
  if (!digits) return "0 ₫";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}

function formatPct(pct: number) {
  return `${pct.toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
}

function typeLabel(
  type: ExpenseType | null,
  customLabel: string | null,
  expenseType: Record<ExpenseType, string>,
) {
  if (!type) return "—";
  if (type === "OTHER" && customLabel) return customLabel;
  return expenseType[type] ?? type;
}

export function ExpenseKpiStrip({ kpis }: { kpis: ExpenseStatsKpis }) {
  const t = useTranslations("expenses");
  const { expenseType } = useLabelMaps();

  const items = [
    {
      key: "total",
      label: t("kpiTotal"),
      value: formatVnd(kpis.totalVnd),
      icon: Banknote,
      tone: "bg-primary-muted text-primary",
    },
    {
      key: "count",
      label: t("kpiCount"),
      value: kpis.count.toLocaleString("vi-VN"),
      icon: Hash,
      tone: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    },
    {
      key: "avg",
      label: t("kpiAvg"),
      value: formatVnd(kpis.avgVnd),
      icon: TrendingUp,
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    },
    {
      key: "matters",
      label: t("kpiMatters"),
      value: kpis.mattersTouched.toLocaleString("vi-VN"),
      icon: Layers,
      tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    {
      key: "topType",
      label: t("kpiTopType"),
      value: typeLabel(kpis.topType, kpis.topTypeCustomLabel, expenseType),
      sub:
        kpis.topType != null
          ? formatPct(kpis.topTypePct)
          : undefined,
      icon: Scale,
      tone: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.key} className="rounded-md">
          <CardContent className="flex items-start gap-3 p-4">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                item.tone,
              )}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                {item.value}
              </p>
              {"sub" in item && item.sub ? (
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {item.sub}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
