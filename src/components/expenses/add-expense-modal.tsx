"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { createMatterExpenseAction } from "@/lib/actions";
import { EXPENSE_TYPES } from "@/lib/validations";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ExpenseMatterOption = {
  id: string;
  code: string;
  title: string;
};

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

function formatVnd(amount: bigint | string) {
  const digits = typeof amount === "bigint" ? amount.toString() : digitsOnly(amount);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
      { amount: x * thousand, label: formatVnd(x * thousand) },
      { amount: x * million, label: formatVnd(x * million) },
      { amount: x * billion, label: formatVnd(x * billion) },
    ];
  } catch {
    return [];
  }
}

function AddExpenseForm({
  matters,
  loadingMatters,
  onClose,
}: {
  matters: ExpenseMatterOption[];
  loadingMatters: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("expense");
  const tCommon = useTranslations("common");
  const { expenseType } = useLabelMaps();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [type, setType] = useState<(typeof EXPENSE_TYPES)[number] | "">("");
  const [amountDigits, setAmountDigits] = useState("");
  const [isPending, startTransition] = useTransition();

  const suggestions = useMemo(() => buildSuggestions(amountDigits), [amountDigits]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("amountVnd", amountDigits);

    setError("");
    setSuccess(false);
    startTransition(async () => {
      const result = await createMatterExpenseAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      window.setTimeout(() => {
        onClose();
      }, 700);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="expense-type">{t("type")}</Label>
        <Select
          id="expense-type"
          name="type"
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
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="expense-matter">{t("matter")}</Label>
        <Select id="expense-matter" name="matterId" required disabled={loadingMatters}>
          <option value="">
            {loadingMatters ? tCommon("loading") : t("matterPlaceholder")}
          </option>
          {matters.map((matter) => (
            <option key={matter.id} value={matter.id}>
              {matter.code} · {matter.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense-amount">{t("amount")}</Label>
        <Input
          id="expense-amount"
          name="amountDisplay"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder={t("amountPlaceholder")}
          value={formatVnd(amountDigits)}
          onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
        />
        <input type="hidden" name="amountVnd" value={amountDigits} />
        {suggestions.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-muted-foreground">{t("suggestions")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="interactive-press rounded-md border border-border bg-muted/60 px-2.5 py-1.5 text-sm text-foreground hover:border-primary/40 hover:bg-primary-muted"
                  onClick={() => setAmountDigits(item.amount.toString())}
                >
                  {item.label} VND
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{t("success")}</p> : null}
      {!loadingMatters && matters.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noOpenMatters")}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isPending || success || loadingMatters || matters.length === 0 || !amountDigits}
        >
          {isPending ? t("saving") : t("confirm")}
        </Button>
      </div>
    </form>
  );
}

export function AddExpenseModal({
  open,
  onClose,
  matters,
  loadingMatters,
}: {
  open: boolean;
  onClose: () => void;
  matters: ExpenseMatterOption[];
  loadingMatters: boolean;
}) {
  const t = useTranslations("expense");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
        className={cn(
          "overlay-panel relative z-10 max-h-[min(92vh,720px)] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="add-expense-title"
            className="text-base font-semibold text-foreground"
          >
            {t("dialogTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AddExpenseForm
          key={open ? "open" : "closed"}
          matters={matters}
          loadingMatters={loadingMatters}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
