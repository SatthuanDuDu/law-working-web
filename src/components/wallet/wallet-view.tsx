"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import type { WalletTxListItem } from "@/lib/wallet-actions";
import type { MoneyConfirmationListItem } from "@/lib/money-confirmation-actions";
import { WalletReceiptLinks } from "@/components/wallet/wallet-receipt-links";
import { MoneyConfirmationsPanel } from "@/components/wallet/money-confirmations-panel";
import { ClientReceiptModal } from "@/components/wallet/client-receipt-modal";
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
  confirmations = [],
}: {
  balanceVnd: string;
  initialTransactions: WalletTxListItem[];
  confirmations?: MoneyConfirmationListItem[];
}) {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [spendOpen, setSpendOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [txMenuOpen, setTxMenuOpen] = useState(false);
  const [txMenuBox, setTxMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const txMenuRef = useRef<HTMLDivElement>(null);
  const txTriggerRef = useRef<HTMLButtonElement>(null);
  const [direction, setDirection] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc">(
    "newest",
  );
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [, startTransition] = useTransition();

  useLayoutEffect(() => {
    if (!txMenuOpen) return;
    function place() {
      const el = txTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = rect.width;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );
      setTxMenuBox({
        top: rect.bottom + 6,
        left,
        width,
      });
    }
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [txMenuOpen]);

  useEffect(() => {
    if (!txMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        txTriggerRef.current?.contains(target) ||
        txMenuRef.current?.contains(target)
      ) {
        return;
      }
      setTxMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTxMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [txMenuOpen]);

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
          <div className="relative w-full sm:w-auto">
            <Button
              ref={txTriggerRef}
              type="button"
              className="interactive-press w-full sm:w-auto"
              aria-haspopup="menu"
              aria-expanded={txMenuOpen}
              onClick={() => setTxMenuOpen((v) => !v)}
            >
              {t("addTransaction")}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  txMenuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
            {txMenuOpen && txMenuBox
              ? createPortal(
                  <div
                    ref={txMenuRef}
                    role="menu"
                    className="fixed z-[70] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
                    style={{
                      top: txMenuBox.top,
                      left: txMenuBox.left,
                      width: txMenuBox.width,
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="interactive-press flex w-full items-center px-3 py-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-primary-muted hover:text-primary focus-visible:bg-primary-muted focus-visible:text-primary focus-visible:outline-none"
                      onClick={() => {
                        setTxMenuOpen(false);
                        setReceiptOpen(true);
                      }}
                    >
                      {t("addReceive")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="interactive-press flex w-full items-center px-3 py-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-primary-muted hover:text-primary focus-visible:bg-primary-muted focus-visible:text-primary focus-visible:outline-none"
                      onClick={() => {
                        setTxMenuOpen(false);
                        setSpendOpen(true);
                      }}
                    >
                      {t("addSpend")}
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>
      </SectionPanel>

      <MoneyConfirmationsPanel confirmations={confirmations} />

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
          <EmptyState className="border-0 bg-transparent py-6">
            {t("empty")}
          </EmptyState>
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
                <WalletReceiptLinks attachments={tx.attachments ?? []} />
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
