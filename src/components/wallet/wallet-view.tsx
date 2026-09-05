"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Shield,
  Wallet,
} from "lucide-react";
import type { BudgetPackageStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import {
  EditExpenseModal,
  canEditSpendTx,
} from "@/components/expenses/edit-expense-modal";
import type { WalletTxListItem } from "@/lib/wallet-actions";
import type { MoneyConfirmationListItem } from "@/lib/money-confirmation-actions";
import type { BudgetPackageDto } from "@/lib/budget-package";
import { WalletReceiptLinks } from "@/components/wallet/wallet-receipt-links";
import { MoneyConfirmationsPanel } from "@/components/wallet/money-confirmations-panel";
import { ClientReceiptModal } from "@/components/wallet/client-receipt-modal";
import { budgetPackageStatusTone } from "@/lib/budget-package-ui";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function pctUsed(allocated: string, remaining: string) {
  try {
    const a = BigInt(allocated);
    if (a <= BigInt(0)) return 0;
    const rem = BigInt(remaining);
    const used = a - rem;
    const p = Number((used * BigInt(1000)) / a) / 10;
    return Math.max(0, Math.min(100, p));
  } catch {
    return 0;
  }
}

export function WalletView({
  balanceVnd,
  packageRemainingSumVnd,
  clientCashHeldVnd,
  packages,
  initialTransactions,
  confirmations = [],
}: {
  balanceVnd: string;
  packageRemainingSumVnd: string;
  clientCashHeldVnd: string;
  packages: BudgetPackageDto[];
  initialTransactions: WalletTxListItem[];
  confirmations?: MoneyConfirmationListItem[];
}) {
  const t = useTranslations("wallet");
  const tPages = useTranslations("pages.wallet");
  const tPkg = useTranslations("budgetPackage");
  const router = useRouter();
  const [spendOpen, setSpendOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editTx, setEditTx] = useState<WalletTxListItem | null>(null);
  const [direction, setDirection] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [packageId, setPackageId] = useState<string>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc">(
    "newest",
  );
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [, startTransition] = useTransition();

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of initialTransactions) {
      if (tx.spendCategoryId && tx.spendCategoryName) {
        map.set(tx.spendCategoryId, tx.spendCategoryName);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [initialTransactions]);

  const packageOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of packages) map.set(p.id, p.name);
    for (const tx of initialTransactions) {
      if (tx.budgetPackageId && tx.budgetPackageName) {
        map.set(tx.budgetPackageId, tx.budgetPackageName);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [packages, initialTransactions]);

  const pendingSumVnd = useMemo(() => {
    try {
      return confirmations
        .reduce((acc, c) => acc + BigInt(c.amountVnd), BigInt(0))
        .toString();
    } catch {
      return "0";
    }
  }, [confirmations]);

  const monthDebitVnd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let sum = BigInt(0);
    for (const tx of initialTransactions) {
      if (tx.direction !== "DEBIT" || tx.legacyImported) continue;
      const d = new Date(tx.createdAt);
      if (d.getFullYear() === y && d.getMonth() === m) {
        try {
          sum += BigInt(tx.amountVnd);
        } catch {
          /* skip */
        }
      }
    }
    return sum.toString();
  }, [initialTransactions]);

  const filtered = useMemo(() => {
    let rows = initialTransactions.filter((tx) => {
      if (!includeLegacy && tx.legacyImported) return false;
      if (direction !== "ALL" && tx.direction !== direction) return false;
      if (categoryId !== "ALL" && tx.spendCategoryId !== categoryId) return false;
      if (packageId !== "ALL" && tx.budgetPackageId !== packageId) return false;
      return true;
    });
    rows = [...rows];
    if (sort === "oldest") {
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else if (sort === "amount_desc") {
      rows.sort((a, b) => Number(BigInt(b.amountVnd) - BigInt(a.amountVnd)));
    } else if (sort === "amount_asc") {
      rows.sort((a, b) => Number(BigInt(a.amountVnd) - BigInt(b.amountVnd)));
    } else {
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return rows;
  }, [
    initialTransactions,
    direction,
    categoryId,
    packageId,
    sort,
    includeLegacy,
  ]);

  const metricCard =
    "rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {tPages("title")}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {tPages("description")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="interactive-press rounded-full"
            onClick={() => setReceiptOpen(true)}
          >
            <ArrowDownLeft className="h-4 w-4" aria-hidden />
            {t("addReceive")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="interactive-press rounded-full"
            onClick={() => setSpendOpen(true)}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden />
            {t("addSpend")}
          </Button>
        </div>
      </section>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <div className={metricCard}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("balance")}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-primary tabular-nums">
                {formatVndDigits(balanceVnd)}{" "}
                <span className="text-sm font-medium text-muted-foreground">₫</span>
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("balanceHint")}</p>
        </div>

        <div className={metricCard}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("clientCashHeld")}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-sky-800 tabular-nums dark:text-sky-300">
                {formatVndDigits(clientCashHeldVnd)}{" "}
                <span className="text-sm font-medium text-muted-foreground">₫</span>
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
              <Shield className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 rounded-lg bg-surface-container-low px-2.5 py-2 text-xs text-muted-foreground">
            {t("clientCashHeldHint")}
          </p>
        </div>

        <div className={metricCard}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("pendingConfirm")}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {formatVndDigits(pendingSumVnd)}{" "}
                <span className="text-sm font-medium text-muted-foreground">₫</span>
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-foreground">
              <ArrowDownLeft className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("pendingConfirmHint", { count: confirmations.length })}
          </p>
        </div>

        <div className={metricCard}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("monthSpend")}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {formatVndDigits(monthDebitVnd)}{" "}
                <span className="text-sm font-medium text-muted-foreground">₫</span>
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-foreground">
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("packageBalance")}: {formatVndDigits(packageRemainingSumVnd)} ₫
          </p>
        </div>
      </div>

      <MoneyConfirmationsPanel confirmations={confirmations} />

      {/* Packages */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {t("myPackages")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("myPackagesHint")}
          </p>
        </div>
        {packages.length === 0 ? (
          <EmptyState className="border-0 bg-transparent py-4">
            {tPkg("noOpenPackages")}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {packages.map((pkg) => {
              const usedPct = pctUsed(pkg.allocatedVnd, pkg.remainingVnd);
              return (
                <article
                  key={pkg.id}
                  className="space-y-3 rounded-xl bg-surface-container-low p-3.5 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded bg-primary-muted px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
                        <Package className="h-3 w-3" aria-hidden />
                        {pkg.matterCode ?? "PKG"}
                      </span>
                      <h3 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
                        <Link
                          href={`/expenses/packages/${pkg.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {pkg.name}
                        </Link>
                      </h3>
                      {pkg.matterTitle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {pkg.matterTitle}
                        </p>
                      ) : null}
                    </div>
                    <StatusChip
                      label={tPkg(`status.${pkg.status as BudgetPackageStatus}`)}
                      tone={budgetPackageStatusTone(pkg.status)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-xs tabular-nums">
                      <span className="text-muted-foreground">
                        {t("pkgUsed")}:{" "}
                        <strong className="font-semibold text-foreground">
                          {formatVndDigits(
                            (
                              BigInt(pkg.allocatedVnd) - BigInt(pkg.remainingVnd)
                            ).toString(),
                          )}{" "}
                          ₫
                        </strong>{" "}
                        ({usedPct}%)
                      </span>
                      <span className="font-semibold text-primary">
                        {t("pkgRemaining")}: {formatVndDigits(pkg.remainingVnd)} ₫
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {t("pkgBudget")}: {formatVndDigits(pkg.allocatedVnd)} ₫
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* History */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {t("history")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("historyHint")}</p>
        </div>

        <div className="grid gap-3 rounded-xl bg-surface-container-low p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="wallet-dir">{t("filterDirection")}</Label>
            <Select
              id="wallet-dir"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as "ALL" | "CREDIT" | "DEBIT")
              }
            >
              <option value="ALL">{t("all")}</option>
              <option value="CREDIT">{t("credit")}</option>
              <option value="DEBIT">{t("debit")}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wallet-pkg">{t("filterPackage")}</Label>
            <Select
              id="wallet-pkg"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="ALL">{t("all")}</option>
              {packageOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wallet-cat">{t("filterCategory")}</Label>
            <Select
              id="wallet-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="ALL">{t("all")}</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wallet-sort">{t("filterSort")}</Label>
            <Select
              id="wallet-sort"
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value as
                    | "newest"
                    | "oldest"
                    | "amount_desc"
                    | "amount_asc",
                )
              }
            >
              <option value="newest">{t("newest")}</option>
              <option value="oldest">{t("oldest")}</option>
              <option value="amount_desc">{t("amountDesc")}</option>
              <option value="amount_asc">{t("amountAsc")}</option>
            </Select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2 lg:col-span-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={includeLegacy}
              onChange={(e) => setIncludeLegacy(e.target.checked)}
            />
            <span className="leading-snug">{t("includeLegacy")}</span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState className="border-0 bg-transparent py-6">
            {t("empty")}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
            {filtered.map((tx) => {
              const metaBits = [
                formatWhen(tx.createdAt),
                `${t("afterBalance")}: ${formatVndDigits(tx.balanceAfterVnd)} ₫`,
              ];
              if (tx.direction === "CREDIT" && tx.allocatedByName) {
                metaBits.push(`${t("allocatedBy")}: ${tx.allocatedByName}`);
              }
              if (tx.matterCode) {
                metaBits.push(
                  `${tx.matterCode}${tx.planStepTitle ? ` · ${tx.planStepTitle}` : ""}`,
                );
              }
              const subtitle =
                tx.detail?.trim() ||
                (tx.direction === "CREDIT" ? tx.note?.trim() : null) ||
                null;

              return (
                <li
                  key={tx.id}
                  className="flex flex-col gap-2 bg-surface px-3 py-3 transition-colors hover:bg-surface-container-low/60 sm:px-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        tx.direction === "CREDIT"
                          ? "bg-primary-muted text-primary"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                      )}
                    >
                      {tx.direction === "CREDIT" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-semibold leading-snug text-foreground">
                        {tx.direction === "CREDIT" ? t("credit") : t("debit")}
                        {tx.budgetPackageName
                          ? ` · ${tx.budgetPackageName}`
                          : ""}
                        {tx.spendCategoryName
                          ? ` · ${tx.spendCategoryName}`
                          : ""}
                        {tx.legacyImported ? ` (${t("legacy")})` : ""}
                      </p>
                      {subtitle ? (
                        <p className="truncate text-sm text-foreground/90">
                          {subtitle}
                        </p>
                      ) : null}
                      <p className="truncate text-[11px] text-muted-foreground">
                        {metaBits.join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums sm:text-[15px]",
                        tx.direction === "CREDIT"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {tx.direction === "CREDIT" ? "+" : "−"}
                      {formatVndDigits(tx.amountVnd)} ₫
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-11">
                    <WalletReceiptLinks attachments={tx.attachments ?? []} />
                    {canEditSpendTx(tx) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="interactive-press h-7 rounded-full px-2.5 text-xs"
                        onClick={() => setEditTx(tx)}
                      >
                        {t("editSpend")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddExpenseModal
        open={spendOpen}
        onClose={() => {
          setSpendOpen(false);
          startTransition(() => router.refresh());
        }}
      />
      <EditExpenseModal
        open={Boolean(editTx)}
        transaction={editTx}
        onClose={() => {
          setEditTx(null);
          startTransition(() => router.refresh());
        }}
      />
      <ClientReceiptModal
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
