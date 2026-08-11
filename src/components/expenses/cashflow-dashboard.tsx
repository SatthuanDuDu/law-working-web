"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { allocateBudgetAction, type WalletTxListItem } from "@/lib/wallet-actions";
import type { MoneyConfirmationListItem } from "@/lib/money-confirmation-actions";
import { WalletReceiptLinks } from "@/components/wallet/wallet-receipt-links";
import { MoneyConfirmationsPanel } from "@/components/wallet/money-confirmations-panel";
import type { CashflowStatsDto } from "@/lib/wallet-stats";
import { formatVndDigits } from "@/lib/wallet";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import { cn } from "@/lib/utils";

function toIso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

export function CashflowDashboard({
  stats,
  users,
  transactions,
  confirmations = [],
}: {
  stats: CashflowStatsDto;
  users: { id: string; name: string; username: string; role: string }[];
  transactions: WalletTxListItem[];
  confirmations?: MoneyConfirmationListItem[];
}) {
  const t = useTranslations("expenses");
  const tWallet = useTranslations("wallet");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amountDigits, setAmountDigits] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [allocPending, startAlloc] = useTransition();

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

  function pushRange(from: string, to: string) {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      router.push(`/expenses?${params.toString()}`);
    });
  }

  function handleAllocate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("amountVnd", amountDigits);
    setError("");
    setSuccess(false);
    startAlloc(async () => {
      const result = await allocateBudgetAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setAmountDigits("");
      form.reset();
      router.refresh();
    });
  }

  const kpis = [
    {
      label: t("kpiCredited"),
      value: `${formatVndDigits(stats.totalCreditedVnd)} ₫`,
      sub: `${stats.creditCount} ${t("kpiCreditCount").toLowerCase()}`,
    },
    {
      label: t("kpiDebited"),
      value: `${formatVndDigits(stats.totalDebitedVnd)} ₫`,
      sub: `${stats.debitCount} ${t("kpiDebitCount").toLowerCase()}`,
    },
    {
      label: t("kpiWallets"),
      value: `${formatVndDigits(stats.walletsTotalBalanceVnd)} ₫`,
      sub: `${stats.byUser.length} users`,
    },
  ];

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-sm flex-1">
          <p className="mb-1.5 text-xs text-muted-foreground">{t("filterLabel")}</p>
          <DateRangeFilter
            dateFrom={stats.from}
            dateTo={stats.to}
            onChange={({ dateFrom, dateTo }) => pushRange(dateFrom, dateTo)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="sm"
              className="interactive-press"
              onClick={() => pushRange(p.from, p.to)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn(liquidPanelClass, "rounded-md border border-border p-4")}
          >
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <MoneyConfirmationsPanel confirmations={confirmations} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionPanel title={t("allocateTitle")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("allocatePendingHint")}</p>
          <form onSubmit={handleAllocate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alloc-user">{t("allocateUser")}</Label>
              <Select id="alloc-user" name="walletUserId" required defaultValue="">
                <option value="" disabled>
                  —
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (@{u.username})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-amount">{t("allocateAmount")}</Label>
              <Input
                id="alloc-amount"
                inputMode="numeric"
                required
                value={formatVndDigits(amountDigits)}
                onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-note">{t("allocateNote")}</Label>
              <Input id="alloc-note" name="note" />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? (
              <p className="text-sm text-emerald-700">{t("allocateSuccess")}</p>
            ) : null}
            <Button type="submit" disabled={allocPending || !amountDigits}>
              {allocPending ? t("allocateSaving") : t("allocateSubmit")}
            </Button>
          </form>
        </SectionPanel>

        <SectionPanel title={t("tableByCategory")}>
          {stats.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className={cn(listDivideClass)}>
              {stats.byCategory.map((row) => (
                <li
                  key={row.spendCategoryId}
                  className={cn(listRowClass, "flex justify-between gap-2 text-sm")}
                >
                  <span>
                    {row.name}
                    <span className="text-muted-foreground"> · {row.count}</span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatVndDigits(row.amountVnd)} ₫
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title={t("tableByUser")}>
        {stats.byUser.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </SectionPanel>

      <SectionPanel title={t("tableTransactions")}>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyTx")}</p>
        ) : (
          <ul className={cn(listDivideClass, "rounded-md border border-border")}>
            {transactions.map((tx) => (
              <li key={tx.id} className={cn(listRowClass, "flex flex-col gap-0.5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {tx.walletUserName}
                    {" · "}
                    {tx.direction === "CREDIT" ? tWallet("credit") : tWallet("debit")}
                    {tx.spendCategoryName ? ` · ${tx.spendCategoryName}` : ""}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {tx.direction === "CREDIT" ? "+" : "−"}
                    {formatVndDigits(tx.amountVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(tx.createdAt)}
                  {tx.allocatedByName
                    ? ` · ${tWallet("allocatedBy")} ${tx.allocatedByName}`
                    : ""}
                  {tx.detail ? ` · ${tx.detail}` : tx.note ? ` · ${tx.note}` : ""}
                </p>
                <WalletReceiptLinks attachments={tx.attachments ?? []} />
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
}
