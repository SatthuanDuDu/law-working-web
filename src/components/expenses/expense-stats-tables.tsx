"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLabelMaps } from "@/i18n/use-label-maps";
import type {
  ExpenseMatterStat,
  ExpenseTypeStat,
} from "@/lib/expense-stats";
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
  type: ExpenseType,
  customLabel: string | null,
  expenseType: Record<ExpenseType, string>,
) {
  if (type === "OTHER" && customLabel) return customLabel;
  return expenseType[type] ?? type;
}

export function ExpenseStatsTables({
  byType,
  byMatter,
}: {
  byType: ExpenseTypeStat[];
  byMatter: ExpenseMatterStat[];
}) {
  const t = useTranslations("expenses");
  const { expenseType } = useLabelMaps();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("tableByType")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {byType.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t("colType")}</th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colAmount")}
                    </th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colCount")}
                    </th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colPct")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {typeLabel(row.type, row.customTypeLabel, expenseType)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-foreground">
                        {formatVnd(row.amountVnd)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.count}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {formatPct(row.pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("tableByMatter")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {byMatter.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t("colMatter")}</th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colAmount")}
                    </th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colCount")}
                    </th>
                    <th className="px-4 py-2 font-medium tabular-nums">
                      {t("colPct")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byMatter.map((row) => (
                    <tr
                      key={row.matterId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/matters/${row.matterId}`}
                          className="interactive-press font-medium text-primary hover:underline"
                        >
                          <span className="font-mono text-xs">{row.code}</span>
                          <span className="mt-0.5 block max-w-[14rem] truncate text-sm text-foreground">
                            {row.title}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-foreground">
                        {formatVnd(row.amountVnd)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.count}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {formatPct(row.pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
