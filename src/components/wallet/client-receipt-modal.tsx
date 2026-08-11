"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  createClientReceiptAction,
  listClientReceiptAssigneesAction,
} from "@/lib/money-confirmation-actions";
import { getPlanStepsForMatterAction } from "@/lib/wallet-actions";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

function ClientReceiptForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations("moneyConfirm");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [amountDigits, setAmountDigits] = useState("");
  const [matterId, setMatterId] = useState("");
  const [steps, setSteps] = useState<{ id: string; title: string }[]>([]);
  const [matters, setMatters] = useState<
    { id: string; code: string; title: string }[] | null
  >(null);
  const [assignees, setAssignees] = useState<
    { id: string; name: string; username: string; role: string }[] | null
  >(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getOpenMattersForExpenseAction(),
      listClientReceiptAssigneesAction(),
    ]).then(([mRes, aRes]) => {
      if (cancelled) return;
      setMatters(mRes.matters ?? []);
      setAssignees(aRes.users ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setError("");
    setSuccess(false);
    startTransition(async () => {
      const result = await createClientReceiptAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      window.setTimeout(() => onClose(), 700);
    });
  }

  const loading = matters === null || assignees === null;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cr-matter">{t("matter")}</Label>
        <Select
          id="cr-matter"
          name="matterId"
          required
          disabled={loading}
          value={matterId}
          onChange={(e) => handleMatterChange(e.target.value)}
        >
          <option value="">
            {loading ? tCommon("loading") : t("matterPlaceholder")}
          </option>
          {(matters ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cr-step">{t("planStep")}</Label>
        <Select id="cr-step" name="matterPlanStepId" disabled={!matterId}>
          <option value="">{t("planStepOptional")}</option>
          {steps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cr-to">{t("assignee")}</Label>
        <Select id="cr-to" name="toUserId" required defaultValue="">
          <option value="" disabled>
            {t("assigneePlaceholder")}
          </option>
          {(assignees ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (@{u.username}) · {u.role}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cr-amount">{t("amount")}</Label>
        <Input
          id="cr-amount"
          inputMode="numeric"
          autoComplete="off"
          required
          value={formatVndDigits(amountDigits)}
          onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cr-note">{t("note")}</Label>
        <Input id="cr-note" name="note" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-sm text-emerald-700">{t("clientReceiptSuccess")}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={isPending || !amountDigits || loading}>
          {isPending ? tCommon("saving") : t("clientReceiptSubmit")}
        </Button>
      </div>
    </form>
  );
}

export function ClientReceiptModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("moneyConfirm");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);

  if (!mounted) return null;

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
        aria-label={tCommon("close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-receipt-title"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-md border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-md sm:p-5",
          "transition-transform duration-150",
          active ? "translate-y-0" : "translate-y-4 sm:translate-y-2",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="client-receipt-title"
              className="text-base font-semibold text-foreground"
            >
              {t("clientReceiptTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("clientReceiptHint")}
            </p>
          </div>
          <button
            type="button"
            className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-muted"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {open ? <ClientReceiptForm key="open" onClose={onClose} /> : null}
      </div>
    </div>,
    document.body,
  );
}
