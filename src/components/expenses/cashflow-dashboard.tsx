"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { MoneyConfirmationsPanel } from "@/components/wallet/money-confirmations-panel";
import { CreatePackageModal } from "@/components/expenses/create-package-modal";
import { ReportExportBar } from "@/components/reports/report-export-bar";
import type { MoneyConfirmationListItem } from "@/lib/money-confirmation-actions";
import type { WalletTxListItem } from "@/lib/wallet-actions";
import type { CashflowStatsDto } from "@/lib/wallet-stats";
import { budgetPackageStatusTone } from "@/lib/budget-package-ui";
import { buildPeriodReport } from "@/lib/report-model";
import { formatVndDigits } from "@/lib/wallet";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import { cn } from "@/lib/utils";
import type { BudgetPackageStatus } from "@prisma/client";

function toIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function CashflowDashboard({
  stats,
  users,
  transactions,
  confirmations = [],
  packageStatus = "ACTIVE",
}: {
  stats: CashflowStatsDto;
  users: { id: string; name: string; username: string; role: string }[];
  transactions: WalletTxListItem[];
  confirmations?: MoneyConfirmationListItem[];
  packageStatus?: string;
}) {
  const t = useTranslations("expenses");
  const tPkg = useTranslations("budgetPackage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const presets = useMemo(() => {
    const now = new Date();
    const lastMonthRef = subMonths(now, 1);
    return [
      {
        key: "thisMonth",
        label: t("presetThisMonth"),
        from: toIso(startOfMonth(now)),
        to: toIso(endOfMonth(now)),
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

  function pushFilters(next: { from?: string; to?: string; status?: string }) {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("from", next.from ?? stats.from);
      params.set("to", next.to ?? stats.to);
      const status = next.status ?? packageStatus;
      if (status && status !== "ALL") params.set("status", status);
      router.push(`/expenses?${params.toString()}`);
    });
  }

  const kpis = [
    {
      label: t("kpiAllocated"),
      value: `${formatVndDigits(stats.packagesAllocatedVnd)} ₫`,
      sub: t("kpiAllocatedSub"),
    },
    {
      label: t("kpiSpent"),
      value: `${formatVndDigits(stats.packagesSpentVnd)} ₫`,
      sub: `${stats.debitCount} ${t("kpiDebitCount").toLowerCase()}`,
    },
    {
      label: t("kpiRemaining"),
      value: `${formatVndDigits(stats.packagesRemainingVnd)} ₫`,
      sub: t("kpiClientCash", {
        amount: formatVndDigits(stats.clientCashHeldVnd),
      }),
    },
    {
      label: t("kpiOpenPackages"),
      value: String(stats.openPackageCount),
      sub:
        stats.pendingTopupCount > 0
          ? t("kpiPendingTopups", { count: stats.pendingTopupCount })
          : t("kpiOpenPackagesSub"),
    },
  ];

  const categoryChart = useMemo(
    () =>
      stats.byCategory.slice(0, 8).map((c) => ({
        name: c.name.length > 14 ? `${c.name.slice(0, 12)}…` : c.name,
        amount: Number(c.amountVnd) / 1_000_000,
      })),
    [stats.byCategory],
  );

  const packageChart = useMemo(
    () =>
      stats.byPackage.slice(0, 8).map((p) => ({
        name: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name,
        spent: Number(p.spentVnd) / 1_000_000,
        remaining: Number(p.remainingVnd) / 1_000_000,
      })),
    [stats.byPackage],
  );

  const periodReport = useMemo(
    () =>
      buildPeriodReport({
        title: t("reportTitle"),
        periodFrom: stats.from,
        periodTo: stats.to,
        transactions,
        allocatedVnd: stats.packagesAllocatedVnd,
        spentVnd: stats.packagesSpentVnd,
        remainingVnd: stats.packagesRemainingVnd,
      }),
    [stats, transactions, t],
  );

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <PageToolbar
        actions={
          <>
            {presets.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                size="sm"
                className="interactive-press"
                onClick={() => pushFilters({ from: p.from, to: p.to })}
              >
                {p.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              className="interactive-press"
              onClick={() => setCreateOpen(true)}
            >
              {tPkg("createCta")}
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 max-w-sm flex-1">
            <p className="mb-1.5 text-xs text-muted-foreground">{t("filterLabel")}</p>
            <DateRangeFilter
              dateFrom={stats.from}
              dateTo={stats.to}
              onChange={({ dateFrom, dateTo }) =>
                pushFilters({ from: dateFrom, to: dateTo })
              }
            />
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="pkg-status-filter" className="mb-1.5 text-xs">
              {t("filterPackageStatus")}
            </Label>
            <Select
              id="pkg-status-filter"
              value={packageStatus}
              onChange={(e) => pushFilters({ status: e.target.value })}
            >
              <option value="ACTIVE">{tPkg("statusActive")}</option>
              <option value="ALL">{tPkg("statusAll")}</option>
              <option value="OPEN">{tPkg("status.OPEN")}</option>
              <option value="PENDING_FUNDING">{tPkg("status.PENDING_FUNDING")}</option>
              <option value="PENDING_SETTLE">{tPkg("status.PENDING_SETTLE")}</option>
              <option value="CLOSED">{tPkg("status.CLOSED")}</option>
            </Select>
          </div>
        </div>
      </PageToolbar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn(liquidPanelClass, "rounded-md border border-border p-3")}
          >
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <MoneyConfirmationsPanel confirmations={confirmations} />

      <SectionPanel title={t("tablePackages")}>
        {stats.byPackage.length === 0 ? (
          <EmptyState>{t("emptyPackages")}</EmptyState>
        ) : (
          <Table
            minWidth="40rem"
            mobileCards
            mobileFallback={
              <ul className={cn(listDivideClass)}>
                {stats.byPackage.map((pkg) => (
                  <li key={pkg.packageId} className={cn(listRowClass, "space-y-1.5")}>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/expenses/packages/${pkg.packageId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {pkg.name}
                      </Link>
                      <StatusChip
                        label={tPkg(`status.${pkg.status}`)}
                        tone={budgetPackageStatusTone(pkg.status)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pkg.ownerName}
                      {pkg.matterCode ? ` · ${pkg.matterCode}` : ""}
                    </p>
                    <PackageProgress pct={pkg.pctSpent} />
                    <div className="flex justify-between text-xs tabular-nums">
                      <span>
                        {t("colSpent")}: {formatVndDigits(pkg.spentVnd)}
                      </span>
                      <span>
                        {t("colRemaining")}: {formatVndDigits(pkg.remainingVnd)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            }
          >
            <THead>
              <tr>
                <TH>{t("colPackage")}</TH>
                <TH>{t("colUser")}</TH>
                <TH>{t("colStatus")}</TH>
                <TH>{t("colProgress")}</TH>
                <TH className="text-right">{t("colAllocated")}</TH>
                <TH className="text-right">{t("colSpent")}</TH>
                <TH className="text-right">{t("colRemaining")}</TH>
              </tr>
            </THead>
            <TBody>
              {stats.byPackage.map((pkg) => (
                <tr key={pkg.packageId} className="border-b border-border/60">
                  <TD>
                    <Link
                      href={`/expenses/packages/${pkg.packageId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {pkg.name}
                    </Link>
                    {pkg.matterCode ? (
                      <span className="block text-xs text-muted-foreground">
                        {pkg.matterCode}
                      </span>
                    ) : null}
                  </TD>
                  <TD>{pkg.ownerName}</TD>
                  <TD>
                    <StatusChip
                      label={tPkg(`status.${pkg.status as BudgetPackageStatus}`)}
                      tone={budgetPackageStatusTone(pkg.status)}
                    />
                  </TD>
                  <TD className="min-w-[7rem]">
                    <PackageProgress pct={pkg.pctSpent} />
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatVndDigits(pkg.allocatedVnd)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatVndDigits(pkg.spentVnd)}
                  </TD>
                  <TD className="text-right tabular-nums font-medium">
                    {formatVndDigits(pkg.remainingVnd)}
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </SectionPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionPanel title={t("chartByCategory")}>
          {categoryChart.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    formatter={(v) => [`${v} tr₫`, t("colAmount")]}
                  />
                  <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionPanel>

        <SectionPanel title={t("chartByPackage")}>
          {packageChart.length === 0 ? (
            <EmptyState>{t("emptyPackages")}</EmptyState>
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={packageChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip />
                  <Bar
                    dataKey="spent"
                    stackId="a"
                    fill="var(--primary)"
                    name={t("colSpent")}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="remaining"
                    stackId="a"
                    fill="var(--accent-muted)"
                    name={t("colRemaining")}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title={t("exportSection")}>
        <ReportExportBar report={periodReport} filenameBase="cashflow-period" />
      </SectionPanel>

      <SectionPanel title={t("tableByUser")}>
        {stats.byUser.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("colUser")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byUser.map((u) => (
                    <tr key={u.userId} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        {u.name}
                        <span className="text-muted-foreground"> @{u.username}</span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums font-medium">
                        {formatVndDigits(u.balanceVnd)} ₫
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={cn(listDivideClass, "sm:hidden")}>
              {stats.byUser.map((u) => (
                <li
                  key={u.userId}
                  className={cn(
                    listRowClass,
                    "flex items-baseline justify-between gap-2 text-sm",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {u.name}
                    <span className="text-muted-foreground"> @{u.username}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatVndDigits(u.balanceVnd)} ₫
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionPanel>

      <CreatePackageModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        users={users}
      />
    </div>
  );
}

function PackageProgress({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="space-y-0.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-[10px] tabular-nums text-muted-foreground">
        {clamped.toFixed(0)}%
      </p>
    </div>
  );
}
