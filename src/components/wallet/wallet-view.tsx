"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import type { WalletTxListItem } from "@/lib/wallet-actions";
import { formatVndDigits } from "@/lib/wallet";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import { cn } from "@/lib/utils";

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

export function WalletView({
  balanceVnd,
  initialTransactions,
}: {
  balanceVnd: string;
  initialTransactions: WalletTxListItem[];
}) {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [spendOpen, setSpendOpen] = useState(false);
  const [direction, setDirection] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [categoryId, setCategoryId] = useState<string>("ALL");
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

  const filtered = useMemo(() => {
    let rows = initialTransactions.filter((tx) => {
      if (!includeLegacy && tx.legacyImported) return false;
      if (direction !== "ALL" && tx.direction !== direction) return false;
      if (categoryId !== "ALL" && tx.spendCategoryId !== categoryId) return false;
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
  }, [initialTransactions, direction, categoryId, sort, includeLegacy]);

  return (
    <div className="space-y-4">
      <SectionPanel title={t("balance")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-2xl font-semibold tracking-tight text-primary">
            {formatVndDigits(balanceVnd)} ₫
          </p>
          <Button
            type="button"
            className="interactive-press w-full sm:w-auto"
            onClick={() => setSpendOpen(true)}
          >
            {t("spend")}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel title={t("history")}>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeLegacy}
              onChange={(e) => setIncludeLegacy(e.target.checked)}
            />
            {t("includeLegacy")}
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className={cn(listDivideClass, "rounded-md border border-border")}>
            {filtered.map((tx) => (
              <li key={tx.id} className={cn(listRowClass, "flex flex-col gap-1")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {tx.direction === "CREDIT" ? t("credit") : t("debit")}
                    {tx.spendCategoryName ? ` · ${tx.spendCategoryName}` : ""}
                    {tx.legacyImported ? ` (${t("legacy")})` : ""}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      tx.direction === "CREDIT"
                        ? "text-emerald-700"
                        : "text-foreground",
                    )}
                  >
                    {tx.direction === "CREDIT" ? "+" : "−"}
                    {formatVndDigits(tx.amountVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(tx.createdAt)}
                  {" · "}
                  {t("afterBalance")}: {formatVndDigits(tx.balanceAfterVnd)} ₫
                </p>
                {tx.direction === "CREDIT" && tx.allocatedByName ? (
                  <p className="text-xs text-muted-foreground">
                    {t("allocatedBy")}: {tx.allocatedByName}
                    {tx.note ? ` — ${tx.note}` : ""}
                  </p>
                ) : null}
                {tx.detail ? (
                  <p className="text-sm text-foreground/90">{tx.detail}</p>
                ) : null}
                {tx.matterCode ? (
                  <p className="text-xs text-muted-foreground">
                    {tx.matterCode} — {tx.matterTitle}
                    {tx.planStepTitle ? ` · ${tx.planStepTitle}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      <AddExpenseModal
        open={spendOpen}
        onClose={() => {
          setSpendOpen(false);
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
