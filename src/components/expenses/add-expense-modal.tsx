"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import {
  getPlanStepsForMatterAction,
  getMyWalletAction,
  listActiveSpendCategoriesAction,
  recordWalletSpendAction,
  type SpendCategoryOption,
} from "@/lib/wallet-actions";
import {
  listMyOpenPackagesAction,
  requestTopupAction,
} from "@/lib/budget-package-actions";
import type { BudgetPackageDto } from "@/lib/budget-package";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { EXPENSE_TYPES } from "@/lib/validations";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { formatVndDigits } from "@/lib/wallet";
import { putAttachmentBytes } from "@/lib/browser-upload";
import { cn } from "@/lib/utils";

export type ExpenseMatterOption = {
  id: string;
  code: string;
  title: string;
};

const MAX_RECEIPT_FILES = 10;
const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;

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
  packages,
  loadingPackages,
  balanceVnd,
  onClose,
}: {
  matters: ExpenseMatterOption[];
  loadingMatters: boolean;
  categories: SpendCategoryOption[];
  packages: BudgetPackageDto[];
  loadingPackages: boolean;
  balanceVnd: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("expense");
  const tPkg = useTranslations("budgetPackage");
  const tCommon = useTranslations("common");
  const { expenseType } = useLabelMaps();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<(typeof EXPENSE_TYPES)[number] | "">("");
  const [matterId, setMatterId] = useState("");
  const [steps, setSteps] = useState<{ id: string; title: string }[]>([]);
  const [amountDigits, setAmountDigits] = useState("");
  const [packageId, setPackageId] = useState("");
  const [splitFromPackageId, setSplitFromPackageId] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupReason, setTopupReason] = useState("");
  const [topupHint, setTopupHint] = useState("");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [uploadHint, setUploadHint] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const selectedCategory =
    categories.find((c) => c.id === effectiveCategoryId) ?? null;
  const requiresMatter = selectedCategory?.requiresMatter ?? false;
  const suggestions = useMemo(() => buildSuggestions(amountDigits), [amountDigits]);

  const effectivePackageId = packageId || packages[0]?.id || "";
  const selectedPackage =
    packages.find((p) => p.id === effectivePackageId) ?? null;
  const remaining = selectedPackage ? BigInt(selectedPackage.remainingVnd) : BigInt(0);
  const amountBig = amountDigits ? BigInt(amountDigits) : BigInt(0);
  const overRemaining = amountBig > remaining && amountBig > BigInt(0);
  const splitOptions = packages.filter((p) => p.id !== effectivePackageId);

  function handleMatterChange(nextId: string) {
    setMatterId(nextId);
    setSteps([]);
    if (!nextId) return;
    void getPlanStepsForMatterAction(nextId).then((res) => {
      setSteps(res.steps ?? []);
    });
  }

  function handleReceiptPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    const next = [...receiptFiles];
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_RECEIPT_FILES) {
        setError(t("receiptsMax", { max: MAX_RECEIPT_FILES }));
        break;
      }
      if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
        setError(t("receiptTooLarge", { name: file.name }));
        continue;
      }
      const dup = next.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
      );
      if (!dup) next.push(file);
    }
    setReceiptFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeReceipt(index: number) {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadReceipts(transactionId: string, files: File[]) {
    let ok = 0;
    for (const file of files) {
      const prepare = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          walletTransactionId: transactionId,
          purpose: "wallet",
        }),
      });
      const prepared = (await prepare.json().catch(() => ({}))) as {
        attachment?: { id: string };
        uploadUrl?: string;
        error?: string;
      };
      if (!prepare.ok || !prepared.attachment?.id || !prepared.uploadUrl) {
        throw new Error(prepared.error || t("receiptUploadFailed"));
      }
      const uploaded = await putAttachmentBytes({
        attachmentId: prepared.attachment.id,
        uploadUrl: prepared.uploadUrl,
        file,
        mimeType: file.type || "application/octet-stream",
      });
      if (!uploaded.ok) {
        await fetch(`/api/attachments/${prepared.attachment.id}`, {
          method: "DELETE",
        }).catch(() => undefined);
        throw new Error(t("receiptUploadFailed"));
      }
      ok += 1;
    }
    return ok;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("amountVnd", amountDigits);
    formData.set("spendCategoryId", effectiveCategoryId);
    formData.set("budgetPackageId", effectivePackageId);
    if (splitFromPackageId) {
      formData.set("splitFromPackageId", splitFromPackageId);
    } else {
      formData.delete("splitFromPackageId");
    }
    const filesToUpload = [...receiptFiles];

    setError("");
    setUploadHint("");
    setSuccess(false);
    startTransition(async () => {
      const result = await recordWalletSpendAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      const txId = result?.transaction?.id;
      if (txId && filesToUpload.length > 0) {
        setUploadHint(t("receiptUploading"));
        try {
          await uploadReceipts(txId, filesToUpload);
        } catch (err) {
          setUploadHint("");
          setError(
            err instanceof Error ? err.message : t("receiptUploadFailedAfterSpend"),
          );
          setSuccess(true);
          router.refresh();
          return;
        }
        setUploadHint("");
      }
      setSuccess(true);
      router.refresh();
      window.setTimeout(() => onClose(), 700);
    });
  }

  function handleRequestTopup() {
    if (!effectivePackageId) return;
    setTopupHint("");
    setError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("packageId", effectivePackageId);
      fd.set("amountVnd", digitsOnly(topupAmount));
      fd.set("reason", topupReason.trim());
      const result = await requestTopupAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTopupHint(tPkg("topupRequested"));
      setShowTopup(false);
      setTopupAmount("");
      setTopupReason("");
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
        <Label htmlFor="spend-package">{tPkg("selectLabel")}</Label>
        <Select
          id="spend-package"
          name="budgetPackageId"
          required
          disabled={loadingPackages}
          value={effectivePackageId}
          onChange={(e) => {
            setPackageId(e.target.value);
            setSplitFromPackageId("");
            setShowTopup(false);
          }}
        >
          {loadingPackages ? (
            <option value="">{tCommon("loading")}</option>
          ) : packages.length === 0 ? (
            <option value="">{tPkg("noOpenPackages")}</option>
          ) : (
            packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {tPkg("remainingShort", {
                  amount: formatVndDigits(p.remainingVnd),
                })}
              </option>
            ))
          )}
        </Select>
        {selectedPackage ? (
          <p className="text-xs text-muted-foreground">
            {tPkg("remaining")}:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatVndDigits(selectedPackage.remainingVnd)} ₫
            </span>
          </p>
        ) : null}
      </div>

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
        {overRemaining ? (
          <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50/80 p-2.5">
            <p className="text-xs text-amber-900">{tPkg("overRemainingWarn")}</p>
            {splitOptions.length > 0 ? (
              <div className="space-y-1">
                <Label htmlFor="spend-split-package">{tPkg("splitPackage")}</Label>
                <Select
                  id="spend-split-package"
                  name="splitFromPackageId"
                  value={splitFromPackageId}
                  onChange={(e) => setSplitFromPackageId(e.target.value)}
                >
                  <option value="">{tPkg("splitOptional")}</option>
                  {splitOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatVndDigits(p.remainingVnd)} ₫
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{tPkg("noSplitPackages")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="interactive-press"
                disabled={isPending || !effectivePackageId}
                onClick={() => setShowTopup((v) => !v)}
              >
                {tPkg("requestTopup")}
              </Button>
            </div>
            {showTopup ? (
              <div className="space-y-2 rounded-md border border-border bg-surface p-2">
                <div className="space-y-1">
                  <Label htmlFor="topup-amount">{tPkg("topupAmount")}</Label>
                  <Input
                    id="topup-amount"
                    inputMode="numeric"
                    value={formatVndDigits(topupAmount)}
                    onChange={(e) => setTopupAmount(digitsOnly(e.target.value))}
                    placeholder={tPkg("topupAmountPlaceholder")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="topup-reason">{tPkg("topupReason")}</Label>
                  <Input
                    id="topup-reason"
                    value={topupReason}
                    onChange={(e) => setTopupReason(e.target.value)}
                    placeholder={tPkg("topupReasonPlaceholder")}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="interactive-press"
                  disabled={
                    isPending ||
                    !digitsOnly(topupAmount) ||
                    topupReason.trim().length < 3
                  }
                  onClick={handleRequestTopup}
                >
                  {tPkg("submitTopup")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spend-note">{t("note")}</Label>
        <Input id="spend-note" name="note" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spend-receipts">{t("receipts")}</Label>
        <input
          ref={fileInputRef}
          id="spend-receipts"
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.heic,.webp"
          className="sr-only"
          onChange={(e) => handleReceiptPick(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="interactive-press"
            disabled={isPending || receiptFiles.length >= MAX_RECEIPT_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" aria-hidden />
            {t("receiptsAdd")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("receiptsHint", { max: MAX_RECEIPT_FILES })}
          </span>
        </div>
        {receiptFiles.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
            {receiptFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  className="interactive-press shrink-0 rounded-md p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                  onClick={() => removeReceipt(index)}
                  aria-label={t("receiptsRemove")}
                  disabled={isPending}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {topupHint ? <p className="text-sm text-emerald-700">{topupHint}</p> : null}
      {uploadHint ? <p className="text-sm text-muted-foreground">{uploadHint}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{t("success")}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={
            isPending ||
            !amountDigits ||
            !effectiveCategoryId ||
            !effectivePackageId
          }
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
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("expense");
  const { mounted, active } = useOverlayAnimation(open);
  const [matters, setMatters] = useState<ExpenseMatterOption[] | null>(null);
  const [categories, setCategories] = useState<SpendCategoryOption[] | null>(null);
  const [packages, setPackages] = useState<BudgetPackageDto[] | null>(null);
  const [balanceVnd, setBalanceVnd] = useState("0");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      getOpenMattersForExpenseAction(),
      getMyWalletAction(),
      listActiveSpendCategoriesAction(),
      listMyOpenPackagesAction(),
    ]).then(([mattersRes, walletRes, catRes, pkgRes]) => {
      if (cancelled) return;
      setMatters(mattersRes.matters ?? []);
      setBalanceVnd(walletRes.balanceVnd ?? "0");
      setCategories(catRes.categories ?? []);
      setPackages(pkgRes.packages ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!mounted) return null;

  const loadingMatters = matters === null;
  const matterOptions = matters ?? [];
  const categoryOptions = categories ?? [];
  const packageOptions = packages ?? [];
  const loadingPackages = packages === null;

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
          packages={packageOptions}
          loadingPackages={loadingPackages}
          balanceVnd={balanceVnd}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
