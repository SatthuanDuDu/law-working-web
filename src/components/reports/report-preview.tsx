"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import type { ReportModel } from "@/lib/report-model";
import { reportTotalCostVnd } from "@/lib/report-model";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export const ReportPreview = forwardRef<
  HTMLDivElement,
  { report: ReportModel; className?: string }
>(function ReportPreview({ report, className }, ref) {
  const t = useTranslations("reports");
  const { meta, rows, totals } = report;
  const totalCost = reportTotalCostVnd(report);

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-border bg-surface p-4 text-foreground print:border-0",
        className,
      )}
    >
      <header className="mb-4 space-y-1 border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">{meta.title}</h2>
        {meta.subtitle ? (
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {meta.grantedByName ? (
            <span>
              {t("grantedBy")}: {meta.grantedByName}
            </span>
          ) : null}
          {meta.ownerName ? (
            <span>
              {t("recipient")}: {meta.ownerName}
            </span>
          ) : null}
          {meta.packageStatus ? (
            <span>
              {t("status")}: {meta.packageStatus}
            </span>
          ) : null}
          {meta.periodFrom || meta.periodTo ? (
            <span>
              {t("period")}: {meta.periodFrom ?? "…"} → {meta.periodTo ?? "…"}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatVndDigits(totalCost)} ₫
          </p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("totalCredit")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatVndDigits(totals.creditVnd)} ₫
          </p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("totalDebit")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatVndDigits(totals.debitVnd)} ₫
          </p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("totalNet")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatVndDigits(totals.netVnd)} ₫
          </p>
        </div>
      </div>

      {totals.allocatedVnd != null || totals.remainingVnd != null ? (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {totals.allocatedVnd != null ? (
            <span>
              {t("allocated")}: {formatVndDigits(totals.allocatedVnd)} ₫
            </span>
          ) : null}
          {totals.spentVnd != null ? (
            <span>
              {t("spent")}: {formatVndDigits(totals.spentVnd)} ₫
            </span>
          ) : null}
          {totals.remainingVnd != null ? (
            <span>
              {t("remaining")}: {formatVndDigits(totals.remainingVnd)} ₫
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">{t("colWhen")}</th>
              <th className="py-1.5 pr-2 font-medium">{t("colDirection")}</th>
              <th className="py-1.5 pr-2 font-medium">{t("colCategory")}</th>
              <th className="py-1.5 pr-2 font-medium">{t("colAmount")}</th>
              <th className="py-1.5 pr-2 font-medium">{t("colNote")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${row.when}-${i}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{row.when}</td>
                  <td className="py-1.5 pr-2">{row.direction}</td>
                  <td className="py-1.5 pr-2">{row.category}</td>
                  <td className="py-1.5 pr-2 tabular-nums font-medium whitespace-nowrap">
                    {formatVndDigits(row.amountVnd)} ₫
                  </td>
                  <td className="py-1.5 pr-2 max-w-[12rem] truncate">{row.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
