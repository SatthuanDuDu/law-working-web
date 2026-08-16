"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  getPlanStepsForMatterAction,
  getMyWalletAction,
  listActiveSpendCategoriesAction,
  getWalletSpendEditContextAction,
  updateWalletSpendAction,
  type SpendCategoryOption,
  type WalletSpendEditContext,
  type WalletTxListItem,
} from "@/lib/wallet-actions";
import { listMyOpenPackagesAction } from "@/lib/budget-package-actions";
import type { BudgetPackageDto } from "@/lib/budget-package";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { EXPENSE_TYPES } from "@/lib/validations";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";
import type { ExpenseMatterOption } from "@/components/expenses/add-expense-modal";

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

export function canEditSpendTx(tx: WalletTxListItem) {
  return (
    tx.direction === "DEBIT" &&
    tx.kind === "SPEND" &&
    !tx.legacyImported
  );
}

export function EditExpenseModal({
  open,
  transaction,
  onClose,
}: {
  open: boolean;
  transaction: WalletTxListItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("wallet");
  const tExpense = useTranslations("expense");
  const tPkg = useTranslations("budgetPackage");
  const tCommon = useTranslations("common");
  const { expenseType } = useLabelMaps();
  const router = useRouter();
  const { mounted, active } = useOverlayAnimation(open);

  const [context, setContext] = useState<WalletSpendEditContext | null>(null);
  const [loadError, setLoadError] = useState("");
  const [matters, setMatters] = useState<ExpenseMatterOption[]>([]);
  const [categories, setCategories] = useState<SpendCategoryOption[]>([]);
  const [packages, setPackages] = useState<BudgetPackageDto[]>([]);
  const [balanceVnd, setBalanceVnd] = useState("0");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<(typeof EXPENSE_TYPES)[number] | "">("");
  const [matterId, setMatterId] = useState("");
  const [planStepId, setPlanStepId] = useState("");
  const [steps, setSteps] = useState<{ id: string; title: string }[]>([]);
  const [amountDigits, setAmountDigits] = useState("");
  const [packageId, setPackageId] = useState("");
  const [splitFromPackageId, setSplitFromPackageId] = useState("");
  const [detail, setDetail] = useState("");
  const [note, setNote] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [justification, setJustification] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !transaction || !canEditSpendTx(transaction)) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      setError("");
      const [ctxRes, cats, pkgs, wallet, openMatters] = await Promise.all([
        getWalletSpendEditContextAction(transaction.id),
        listActiveSpendCategoriesAction(),
        listMyOpenPackagesAction(),
        getMyWalletAction(),
        getOpenMattersForExpenseAction(),
      ]);
      if (cancelled) return;
      if ("error" in ctxRes && ctxRes.error) {
        setLoadError(ctxRes.error);
        setContext(null);
        setLoading(false);
        return;
      }
      if (!("context" in ctxRes) || !ctxRes.context) {
        setLoadError("Không tải được khoản chi");
        setContext(null);
        setLoading(false);
        return;
      }
      const ctx = ctxRes.context;
      setContext(ctx);
      setCategories(cats.categories ?? []);
      setPackages(pkgs.packages ?? []);
      setBalanceVnd(wallet.balanceVnd ?? "0");
      setMatters(openMatters.matters ?? []);
      setCategoryId(ctx.spendCategoryId ?? "");
      setAmountDigits(ctx.amountVnd);
      setPackageId(ctx.budgetPackageId ?? "");
      setSplitFromPackageId(ctx.splitFromPackageId ?? "");
      setDetail(ctx.detail ?? "");
      setNote(ctx.note ?? "");
      setMatterId(ctx.matterId ?? "");
      setPlanStepId(ctx.matterPlanStepId ?? "");
      setType(ctx.expenseType ?? "");
      setCustomTypeLabel(ctx.customTypeLabel ?? "");
      setJustification("");
      if (ctx.matterId) {
        const stepRes = await getPlanStepsForMatterAction(ctx.matterId);
        if (!cancelled) setSteps(stepRes.steps ?? []);
      } else {
        setSteps([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, transaction]);

  const creditByPackage = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const row of context?.packageAmountCredits ?? []) {
      const prev = map.get(row.packageId) ?? BigInt(0);
      map.set(row.packageId, prev + BigInt(row.amountVnd));
    }
    return map;
  }, [context]);

  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const selectedCategory =
    categories.find((c) => c.id === effectiveCategoryId) ?? null;
  const requiresMatter = selectedCategory?.requiresMatter ?? false;
  const effectivePackageId = packageId || packages[0]?.id || "";
  const selectedPackage =
    packages.find((p) => p.id === effectivePackageId) ?? null;
  const remaining = selectedPackage
    ? BigInt(selectedPackage.remainingVnd) +
      (creditByPackage.get(selectedPackage.id) ?? BigInt(0))
    : BigInt(0);
  const amountBig = amountDigits ? BigInt(amountDigits) : BigInt(0);
  const overRemaining = amountBig > remaining && amountBig > BigInt(0);
  const splitOptions = packages.filter((p) => p.id !== effectivePackageId);
  const oldTotal = context ? BigInt(context.amountVnd) : BigInt(0);
  const availableBalance = BigInt(balanceVnd || "0") + oldTotal;

  function handleMatterChange(nextId: string) {
    setMatterId(nextId);
    setPlanStepId("");
    setSteps([]);
    if (!nextId) return;
    void getPlanStepsForMatterAction(nextId).then((res) => {
      setSteps(res.steps ?? []);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!context) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("transactionId", context.keepTransactionId);
    formData.set("amountVnd", amountDigits);
    formData.set("spendCategoryId", effectiveCategoryId);
    formData.set("budgetPackageId", effectivePackageId);
    formData.set("justification", justification.trim());
    formData.set("detail", detail);
    if (note) formData.set("note", note);
    else formData.delete("note");
    if (splitFromPackageId) {
      formData.set("splitFromPackageId", splitFromPackageId);
    } else {
      formData.delete("splitFromPackageId");
    }
    if (requiresMatter) {
      formData.set("matterId", matterId);
      if (planStepId) formData.set("matterPlanStepId", planStepId);
      else formData.delete("matterPlanStepId");
      if (type) formData.set("expenseType", type);
      if (type === "OTHER") formData.set("customTypeLabel", customTypeLabel);
    }
    setError("");
    startTransition(async () => {
      const result = await updateWalletSpendAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

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
        aria-labelledby="edit-expense-title"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-md border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-md sm:p-5",
          "transition-transform duration-150",
          active ? "translate-y-0" : "translate-y-4 sm:translate-y-2",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="edit-expense-title" className="text-base font-semibold text-foreground">
            {t("editSpendTitle")}
          </h2>
          <button
            type="button"
            className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-muted"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : context ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              {context.siblingCount > 1 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-900">
                  {t("editSplitHint")}
                </p>
              ) : null}

              <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                {tExpense("balance")}:{" "}
                <span className="font-medium text-foreground">
                  {formatVndDigits(balanceVnd)} ₫
                </span>
                {" · "}
                khả dụng khi sửa:{" "}
                <span className="font-medium text-foreground">
                  {formatVndDigits(availableBalance.toString())} ₫
                </span>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-package">{tPkg("selectLabel")}</Label>
                <Select
                  id="edit-spend-package"
                  name="budgetPackageId"
                  required
                  value={effectivePackageId}
                  onChange={(e) => {
                    setPackageId(e.target.value);
                    setSplitFromPackageId("");
                  }}
                >
                  {packages.map((p) => {
                    const rem =
                      BigInt(p.remainingVnd) +
                      (creditByPackage.get(p.id) ?? BigInt(0));
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatVndDigits(rem.toString())} ₫
                      </option>
                    );
                  })}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-cat">{tExpense("category")}</Label>
                <Select
                  id="edit-spend-cat"
                  name="spendCategoryId"
                  required
                  value={effectiveCategoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              {requiresMatter ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-spend-matter">{tExpense("matter")}</Label>
                    <Select
                      id="edit-spend-matter"
                      name="matterId"
                      required
                      value={matterId}
                      onChange={(e) => handleMatterChange(e.target.value)}
                    >
                      <option value="">{tExpense("matterPlaceholder")}</option>
                      {matters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} — {m.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {steps.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-spend-step">{tExpense("planStep")}</Label>
                      <Select
                        id="edit-spend-step"
                        name="matterPlanStepId"
                        value={planStepId}
                        onChange={(e) => setPlanStepId(e.target.value)}
                      >
                        <option value="">{tExpense("planStepOptional")}</option>
                        {steps.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-spend-type">{tExpense("type")}</Label>
                    <Select
                      id="edit-spend-type"
                      name="expenseType"
                      required
                      value={type}
                      onChange={(e) =>
                        setType(
                          e.target.value as (typeof EXPENSE_TYPES)[number] | "",
                        )
                      }
                    >
                      <option value="">{tExpense("typePlaceholder")}</option>
                      {EXPENSE_TYPES.map((et) => (
                        <option key={et} value={et}>
                          {expenseType[et] ?? et}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {type === "OTHER" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-custom-type">
                        {tExpense("customType")}
                      </Label>
                      <Input
                        id="edit-custom-type"
                        name="customTypeLabel"
                        value={customTypeLabel}
                        onChange={(e) => setCustomTypeLabel(e.target.value)}
                        required
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-detail">{tExpense("detail")}</Label>
                <Input
                  id="edit-spend-detail"
                  name="detail"
                  required
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-amount">{tExpense("amount")}</Label>
                <Input
                  id="edit-spend-amount"
                  inputMode="numeric"
                  required
                  value={formatVndDigits(amountDigits)}
                  onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
                />
              </div>

              {overRemaining ? (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/80 p-2.5">
                  <p className="text-xs text-amber-900">{tPkg("overRemainingWarn")}</p>
                  {splitOptions.length > 0 ? (
                    <div className="space-y-1">
                      <Label htmlFor="edit-split">{tPkg("splitPackage")}</Label>
                      <Select
                        id="edit-split"
                        name="splitFromPackageId"
                        value={splitFromPackageId}
                        onChange={(e) => setSplitFromPackageId(e.target.value)}
                      >
                        <option value="">{tPkg("splitOptional")}</option>
                        {splitOptions.map((p) => {
                          const rem =
                            BigInt(p.remainingVnd) +
                            (creditByPackage.get(p.id) ?? BigInt(0));
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatVndDigits(rem.toString())} ₫
                            </option>
                          );
                        })}
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-note">{tExpense("note")}</Label>
                <Input
                  id="edit-spend-note"
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend-why">{t("editJustification")}</Label>
                <Input
                  id="edit-spend-why"
                  name="justification"
                  required
                  minLength={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder={t("editJustificationPlaceholder")}
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pb-1 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="interactive-press"
                  onClick={onClose}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="submit"
                  className="interactive-press"
                  disabled={isPending}
                >
                  {t("editSave")}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
