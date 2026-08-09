"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  getPlanStepsForMatterAction,
  getMyWalletAction,
  listActiveSpendCategoriesAction,
  recordWalletSpendAction,
  type SpendCategoryOption,
} from "@/lib/wallet-actions";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { EXPENSE_TYPES } from "@/lib/validations";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export type ExpenseMatterOption = {
  id: string;
  code: string;
  title: string;
};

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

function buildSuggestions(rawDigits: string) {
  const base = digitsOnly(rawDigits);
  if (!base || /^0+$/.test(base)) return [];
  try {
    const x = BigInt(base);
    const thousand = BigInt(1000);
    const million = BigInt(1_000_000);
    const billion = BigInt(1_000_000_000);
    return [
      { amount: x * thousand, label: formatVndDigits(x * thousand) },
      { amount: x * million, label: formatVndDigits(x * million) },
      { amount: x * billion, label: formatVndDigits(x * billion) },
    ];
  } catch {
    return [];
  }
}

function WalletSpendForm({
  matters,
  loadingMatters,
  categories,
  balanceVnd,
  onClose,
}: {
  matters: ExpenseMatterOption[];
  loadingMatters: boolean;
  categories: SpendCategoryOption[];
  balanceVnd: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("expense");
  const tCommon = useTranslations("common");
  const { expenseType } = useLabelMaps();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<(typeof EXPENSE_TYPES)[number] | "">("");
  const [matterId, setMatterId] = useState("");
  const [steps, setSteps] = useState<{ id: string; title: string }[]>([]);
  const [amountDigits, setAmountDigits] = useState("");
  const [isPending, startTransition] = useTransition();

  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const selectedCategory =
    categories.find((c) => c.id === effectiveCategoryId) ?? null;
  const requiresMatter = selectedCategory?.requiresMatter ?? false;
  const suggestions = useMemo(() => buildSuggestions(amountDigits), [amountDigits]);

  function handleMatterChange(nextId: string) {
    setMatterId(nextId);
    setSteps([]);
    if (!nextId) return;
    void getPlanStepsForMatterAction(nextId).then((res) => {
      setSteps(res.steps ?? []);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("amountVnd", amountDigits);
    formData.set("spendCategoryId", effectiveCategoryId);

    setError("");
    setSuccess(false);
    startTransition(async () => {
      const result = await recordWalletSpendAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      window.setTimeout(() => onClose(), 700);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        {t("balance")}:{" "}
        <span className="font-medium text-foreground">
          {formatVndDigits(balanceVnd)} ₫
        </span>
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="spend-category">{t("category")}</Label>
        <Select
          id="spend-category"
          name="spendCategoryId"
          required
          value={effectiveCategoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setMatterId("");
            setSteps([]);
            setType("");
          }}
        >
          {categories.length === 0 ? (
            <option value="">{t("noCategories")}</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </Select>
      </div>

      {requiresMatter ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="expense-matter">{t("matter")}</Label>
            <Select
              id="expense-matter"
              name="matterId"
              required
              disabled={loadingMatters}
              value={matterId}
              onChange={(e) => handleMatterChange(e.target.value)}
            >
              <option value="">
                {loadingMatters ? tCommon("loading") : t("matterPlaceholder")}
              </option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.title}
                </option>
              ))}
            </Select>
            {!loadingMatters && matters.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noOpenMatters")}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-step">{t("planStep")}</Label>
            <Select id="expense-step" name="matterPlanStepId" disabled={!matterId}>
              <option value="">{t("planStepOptional")}</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-type">{t("type")}</Label>
            <Select
              id="expense-type"
              name="expenseType"
              required
              value={type}
              onChange={(e) => setType(e.target.value as (typeof EXPENSE_TYPES)[number] | "")}
            >
              <option value="">{t("typePlaceholder")}</option>
              {EXPENSE_TYPES.map((key) => (
                <option key={key} value={key}>
                  {expenseType[key]}
                </option>
              ))}
            </Select>
          </div>

          {type === "OTHER" ? (
            <div className="space-y-1.5">
              <Label htmlFor="expense-custom-type">{t("customType")}</Label>
              <Input
                id="expense-custom-type"
                name="customTypeLabel"
                required
                placeholder={t("customTypePlaceholder")}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="spend-detail">{t("detail")}</Label>
        <Input
          id="spend-detail"
          name="detail"
          required
          placeholder={
            requiresMatter
              ? t("detailMatterPlaceholder")
              : t("detailOtherPlaceholder")
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense-amount">{t("amount")}</Label>
        <Input
          id="expense-amount"
          inputMode="numeric"
          autoComplete="off"
          required
          value={formatVndDigits(amountDigits)}
          placeholder={t("amountPlaceholder")}
          onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
        />
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="w-full text-xs text-muted-foreground">{t("suggestions")}</span>
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                className="interactive-press rounded-md border border-border bg-surface px-2 py-1 text-xs"
                onClick={() => setAmountDigits(s.amount.toString())}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spend-note">{t("note")}</Label>
        <Input id="spend-note" name="note" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{t("success")}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={isPending || !amountDigits || !effectiveCategoryId}>
          {isPending ? t("saving") : t("confirm")}
        </Button>
      </div>
    </form>
  );
}

export function AddExpenseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("expense");
  const { mounted, active } = useOverlayAnimation(open);
  const [matters, setMatters] = useState<ExpenseMatterOption[] | null>(null);
  const [categories, setCategories] = useState<SpendCategoryOption[] | null>(null);
  const [balanceVnd, setBalanceVnd] = useState("0");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      getOpenMattersForExpenseAction(),
      getMyWalletAction(),
      listActiveSpendCategoriesAction(),
    ]).then(([mattersRes, walletRes, catRes]) => {
      if (cancelled) return;
      setMatters(mattersRes.matters ?? []);
      setBalanceVnd(walletRes.balanceVnd ?? "0");
      setCategories(catRes.categories ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!mounted) return null;

  const loadingMatters = matters === null;
  const matterOptions = matters ?? [];
  const categoryOptions = categories ?? [];

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4",
        "transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-md border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-md sm:p-5",
          "transition-transform duration-150",
          active ? "translate-y-0" : "translate-y-4 sm:translate-y-2",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="add-expense-title" className="text-base font-semibold text-foreground">
            {t("dialogTitle")}
          </h2>
          <button
            type="button"
            className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <WalletSpendForm
          matters={matterOptions}
          loadingMatters={loadingMatters}
          categories={categoryOptions}
          balanceVnd={balanceVnd}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
