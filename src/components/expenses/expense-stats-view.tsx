"use client";

import dynamic from "next/dynamic";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from "date-fns";
import { useTranslations } from "next-intl";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Button } from "@/components/ui/button";
import { ExpenseKpiStrip } from "@/components/expenses/expense-kpi-strip";
import { ExpenseStatsTables } from "@/components/expenses/expense-stats-tables";
import type { ExpenseStatsDto } from "@/lib/expense-stats";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { cn } from "@/lib/utils";

const ExpenseCharts = dynamic(
  () =>
    import("@/components/expenses/expense-charts").then((m) => m.ExpenseCharts),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-md bg-muted" />
    ),
    ssr: false,
  },
);

function toIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function ExpenseStatsView({ stats }: { stats: ExpenseStatsDto }) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const presets = useMemo(() => {
    const now = new Date();
    const thisMonthFrom = startOfMonth(now);
    const thisMonthTo = endOfMonth(now);
    const lastMonthRef = subMonths(now, 1);
    return [
      {
        key: "thisMonth",
        label: t("presetThisMonth"),
        from: toIso(thisMonthFrom),
        to: toIso(thisMonthTo),
      },
      {
        key: "lastMonth",
        label: t("presetLastMonth"),
        from: toIso(startOfMonth(lastMonthRef)),
        to: toIso(endOfMonth(lastMonthRef)),
      },
      {
        key: "thisQuarter",
        label: t("presetThisQuarter"),
        from: toIso(startOfQuarter(now)),
        to: toIso(endOfQuarter(now)),
      },
      {
        key: "thisYear",
        label: t("presetThisYear"),
        from: toIso(startOfYear(now)),
        to: toIso(endOfYear(now)),
      },
    ] as const;
  }, [t]);

  function pushRange(from: string, to: string) {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    startTransition(() => {
      router.push(`/expenses?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <div
        className={cn("sticky z-10 min-w-0", pending && "opacity-80")}
        style={{ top: "var(--page-header-offset)" }}
      >
        <div
          className={cn(liquidPanelClass, "min-w-0 rounded-md p-2.5 sm:p-3")}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("filterLabel")}</p>
              <div className="mt-1.5 max-w-sm">
                <DateRangeFilter
                  dateFrom={stats.from}
                  dateTo={stats.to}
                  onChange={({ dateFrom, dateTo }) => {
                    if (!dateFrom || !dateTo) return;
                    pushRange(dateFrom, dateTo);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const active =
                  preset.from === stats.from && preset.to === stats.to;
                return (
                  <Button
                    key={preset.key}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="interactive-press"
                    disabled={pending}
                    onClick={() => pushRange(preset.from, preset.to)}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ExpenseKpiStrip kpis={stats.kpis} />

      <ExpenseCharts
        byType={stats.byType}
        byMatter={stats.byMatter}
        series={stats.series}
        bucket={stats.bucket}
      />

      <ExpenseStatsTables byType={stats.byType} byMatter={stats.byMatter} />
    </div>
  );
}
