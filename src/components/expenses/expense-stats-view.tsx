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
import { FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Button } from "@/components/ui/button";
import { ExpenseKpiStrip } from "@/components/expenses/expense-kpi-strip";
import { ExpenseStatsTables } from "@/components/expenses/expense-stats-tables";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { downloadExcelSheets } from "@/lib/export-excel";
import type { ExpenseStatsDto } from "@/lib/expense-stats";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { cn } from "@/lib/utils";
import type { ExpenseType } from "@prisma/client";

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

function formatVnd(amount: string) {
  const digits = amount.replace(/\D/g, "");
  if (!digits) return "0";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function typeLabel(
  type: ExpenseType,
  customLabel: string | null,
  expenseType: Record<ExpenseType, string>,
) {
  if (type === "OTHER" && customLabel) return customLabel;
  return expenseType[type] ?? type;
}

export function ExpenseStatsView({ stats }: { stats: ExpenseStatsDto }) {
  const t = useTranslations("expenses");
  const tPages = useTranslations("pages.expenses");
  const tCommon = useTranslations("common");
  const { expenseType } = useLabelMaps();
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

  function handleExportExcel() {
    const sheets = [
      {
        name: t("sheetByType"),
        rows: stats.byType.map((row) => ({
          [t("colType")]: typeLabel(row.type, row.customTypeLabel, expenseType),
          [t("colAmount")]: formatVnd(row.amountVnd),
          [t("colCount")]: row.count,
          [t("colPct")]: row.pct,
        })),
      },
      {
        name: t("sheetByMatter"),
        rows: stats.byMatter.map((row) => ({
          [t("colCode")]: row.code,
          [t("colTitle")]: row.title,
          [t("colAmount")]: formatVnd(row.amountVnd),
          [t("colCount")]: row.count,
          [t("colPct")]: row.pct,
        })),
      },
    ].filter((sheet) => sheet.rows.length > 0);
    if (sheets.length === 0) return;
    void downloadExcelSheets(`chi-phi-${stats.from}_${stats.to}`, sheets);
  }

  const canExport = stats.byType.length > 0 || stats.byMatter.length > 0;

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
            <div className="flex flex-wrap items-center gap-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="interactive-press"
                disabled={!canExport}
                onClick={handleExportExcel}
                aria-label={tCommon("exportExcel")}
                title={tPages("title")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
              </Button>
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
