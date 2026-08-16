"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { BudgetPackageStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { ReportExportBar } from "@/components/reports/report-export-bar";
import { RevisionHistory } from "@/components/history/revision-history";
import {
  decideSettlePackageAction,
  decideTopupRequestAction,
  requestSettlePackageAction,
  requestTopupAction,
  topupPackageAction,
  updateBudgetPackageAction,
} from "@/lib/budget-package-actions";
import type { BudgetPackageDto } from "@/lib/budget-package";
import { budgetPackageStatusTone, packageSpendPct } from "@/lib/budget-package-ui";
import { buildPackageReport } from "@/lib/report-model";
import { formatVndDigits } from "@/lib/wallet";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import { cn } from "@/lib/utils";

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
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

export type PackageDetailTx = {
  id: string;
  direction: string;
  kind: string;
  amountVnd: string;
  balanceAfterVnd: string;
  note: string | null;
  detail: string | null;
  spendCategoryName: string | null;
  createdByName: string;
  matterCode: string | null;
  matterTitle: string | null;
  createdAt: string;
  splitGroupId: string | null;
};

export type PackagePendingTopup = {
  id: string;
  amountVnd: string;
  reason: string;
  status: string;
  createdAt: string;
  requestedByName: string;
};

export type PackagePendingSettle = {
  confirmationId: string;
  amountVnd: string;
  note: string | null;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
};

export function PackageDetailView({
  pkg,
  transactions,
  pendingTopups,
  pendingSettle,
  currentUserId,
  canManage,
  carryTargets,
}: {
  pkg: BudgetPackageDto;
  transactions: PackageDetailTx[];
  pendingTopups: PackagePendingTopup[];
  pendingSettle: PackagePendingSettle | null;
  currentUserId: string;
  canManage: boolean;
  carryTargets: { id: string; name: string }[];
}) {
  const t = useTranslations("budgetPackage");
  const tWallet = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [topupDigits, setTopupDigits] = useState("");
  const [requestDigits, setRequestDigits] = useState("");
  const [panel, setPanel] = useState<
    null | "topup" | "requestTopup" | "settle" | "edit"
  >(null);
  const [editName, setEditName] = useState(pkg.name);
  const [editNote, setEditNote] = useState(pkg.note ?? "");
  const [editWhy, setEditWhy] = useState("");

  const isOwner = pkg.ownerUserId === currentUserId;
  const isOpen = pkg.status === "OPEN";
  const isPendingSettle = pkg.status === "PENDING_SETTLE";
  const canEditMeta =
    (canManage || isOwner) &&
    pkg.status !== "CLOSED" &&
    pkg.status !== "CANCELLED";
  const pct = packageSpendPct(pkg.allocatedVnd, pkg.spentVnd);

  const report = useMemo(
    () =>
      buildPackageReport({
        title: t("reportTitle"),
        packageName: pkg.name,
        packageStatus: pkg.status,
        ownerName: pkg.ownerName,
        grantedByName: pkg.createdByName,
        allocatedVnd: pkg.allocatedVnd,
        spentVnd: pkg.spentVnd,
        remainingVnd: pkg.remainingVnd,
        transactions,
      }),
    [pkg, transactions, t],
  );

  function runAction(fn: () => Promise<{ error?: string } | void>) {
    setError("");
    startTransition(async () => {
      const result = await fn();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setPanel(null);
      setTopupDigits("");
      setRequestDigits("");
      setEditWhy("");
      router.refresh();
    });
  }

  function handleManagerTopup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("packageId", pkg.id);
    formData.set("amountVnd", topupDigits);
    runAction(() => topupPackageAction(formData));
  }

  function handleEditPackage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("packageId", pkg.id);
    formData.set("name", editName.trim());
    formData.set("note", editNote.trim());
    formData.set("justification", editWhy.trim());
    runAction(() => updateBudgetPackageAction(formData));
  }

  function handleRequestTopup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("packageId", pkg.id);
    formData.set("amountVnd", requestDigits);
    runAction(() => requestTopupAction(formData));
  }

  function handleRequestSettle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("packageId", pkg.id);
    runAction(() => requestSettlePackageAction(formData));
  }

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/expenses" className="text-muted-foreground hover:text-foreground">
          ← {t("backToExpenses")}
        </Link>
      </div>

      <div
        className={cn(
          liquidPanelClass,
          "rounded-md border border-border p-4 space-y-3",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{pkg.name}</h1>
              <StatusChip
                label={t(`status.${pkg.status as BudgetPackageStatus}`)}
                tone={budgetPackageStatusTone(pkg.status)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("owner")}: {pkg.ownerName}
              {pkg.matterCode
                ? ` · ${pkg.matterCode}${pkg.matterTitle ? ` — ${pkg.matterTitle}` : ""}`
                : ""}
            </p>
            {pkg.note ? (
              <p className="text-sm text-muted-foreground">{pkg.note}</p>
            ) : null}
            <RevisionHistory entityType="BudgetPackage" entityId={pkg.id} />
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditMeta ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="interactive-press"
                onClick={() => {
                  setEditName(pkg.name);
                  setEditNote(pkg.note ?? "");
                  setEditWhy("");
                  setPanel(panel === "edit" ? null : "edit");
                }}
              >
                {t("editPackage")}
              </Button>
            ) : null}
            {canManage && isOpen ? (
              <Button
                type="button"
                size="sm"
                className="interactive-press"
                onClick={() => setPanel(panel === "topup" ? null : "topup")}
              >
                {t("topup")}
              </Button>
            ) : null}
            {isOwner && isOpen ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="interactive-press"
                  onClick={() =>
                    setPanel(panel === "requestTopup" ? null : "requestTopup")
                  }
                >
                  {t("requestTopup")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="interactive-press"
                  onClick={() => setPanel(panel === "settle" ? null : "settle")}
                >
                  {t("requestSettle")}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label={t("allocated")} value={pkg.allocatedVnd} />
          <Metric label={t("spent")} value={pkg.spentVnd} />
          <Metric label={t("remaining")} value={pkg.remainingVnd} emphasize />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {panel === "edit" ? (
        <SectionPanel title={t("editPackageTitle")}>
          <form onSubmit={handleEditPackage} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="edit-pkg-name">{t("name")}</Label>
              <Input
                id="edit-pkg-name"
                name="name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pkg-note">{t("note")}</Label>
              <Input
                id="edit-pkg-note"
                name="note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pkg-why">{t("editJustification")}</Label>
              <Input
                id="edit-pkg-why"
                name="justification"
                required
                minLength={3}
                value={editWhy}
                onChange={(e) => setEditWhy(e.target.value)}
                placeholder={t("editJustificationPlaceholder")}
              />
            </div>
            <Button
              type="submit"
              disabled={pending || editName.trim().length < 1 || editWhy.trim().length < 3}
            >
              {pending ? tCommon("saving") : t("editPackageSubmit")}
            </Button>
          </form>
        </SectionPanel>
      ) : null}

      {panel === "topup" ? (
        <SectionPanel title={t("topupTitle")}>
          <form onSubmit={handleManagerTopup} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount">{t("amount")}</Label>
              <Input
                id="topup-amount"
                inputMode="numeric"
                required
                value={formatVndDigits(topupDigits)}
                onChange={(e) => setTopupDigits(digitsOnly(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-note">{t("note")}</Label>
              <Input id="topup-note" name="note" />
            </div>
            <Button type="submit" disabled={pending || !topupDigits}>
              {pending ? tCommon("saving") : t("topupSubmit")}
            </Button>
          </form>
        </SectionPanel>
      ) : null}

      {panel === "requestTopup" ? (
        <SectionPanel title={t("requestTopupTitle")}>
          <form onSubmit={handleRequestTopup} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="req-amount">{t("amount")}</Label>
              <Input
                id="req-amount"
                inputMode="numeric"
                required
                value={formatVndDigits(requestDigits)}
                onChange={(e) => setRequestDigits(digitsOnly(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-reason">{t("reason")}</Label>
              <Input id="req-reason" name="reason" required minLength={3} />
            </div>
            <Button type="submit" disabled={pending || !requestDigits}>
              {pending ? tCommon("saving") : t("requestTopupSubmit")}
            </Button>
          </form>
        </SectionPanel>
      ) : null}

      {panel === "settle" ? (
        <SectionPanel title={t("settleTitle")}>
          <form onSubmit={handleRequestSettle} className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="settle-mode">{t("settleMode")}</Label>
              <Select id="settle-mode" name="settleMode" defaultValue="REFUND">
                <option value="REFUND">{t("settleRefund")}</option>
                <option value="CARRY_FORWARD">{t("settleCarry")}</option>
              </Select>
            </div>
            {carryTargets.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="carry-to">{t("carryTo")}</Label>
                <Select id="carry-to" name="carryToPackageId" defaultValue="">
                  <option value="">—</option>
                  {carryTargets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="settle-note">{t("note")}</Label>
              <Input id="settle-note" name="note" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settleHint", {
                amount: formatVndDigits(pkg.remainingVnd),
              })}
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? tCommon("saving") : t("settleSubmit")}
            </Button>
          </form>
        </SectionPanel>
      ) : null}

      {pendingTopups.length > 0 ? (
        <SectionPanel title={t("pendingTopups")}>
          <ul className={cn(listDivideClass)}>
            {pendingTopups.map((req) => (
              <li
                key={req.id}
                className={cn(listRowClass, "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between")}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums">
                    {formatVndDigits(req.amountVnd)} ₫
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.requestedByName} · {formatWhen(req.createdAt)}
                  </p>
                  <p className="text-sm">{req.reason}</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="interactive-press"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("requestId", req.id);
                        fd.set("decision", "APPROVE");
                        runAction(() => decideTopupRequestAction(fd));
                      }}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="interactive-press"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("requestId", req.id);
                        fd.set("decision", "REJECT");
                        runAction(() => decideTopupRequestAction(fd));
                      }}
                    >
                      {t("reject")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      {isPendingSettle && pendingSettle ? (
        <SectionPanel title={t("pendingSettle")}>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("settlePendingHint", {
              amount: formatVndDigits(pendingSettle.amountVnd),
              mode: pkg.settleMode === "CARRY_FORWARD"
                ? t("settleCarry")
                : t("settleRefund"),
            })}
          </p>
          {pendingSettle.toUserId === currentUserId ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="interactive-press"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("confirmationId", pendingSettle.confirmationId);
                  fd.set("decision", "APPROVE");
                  runAction(() => decideSettlePackageAction(fd));
                }}
              >
                {t("approveSettle")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="interactive-press"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("confirmationId", pendingSettle.confirmationId);
                  fd.set("decision", "REJECT");
                  runAction(() => decideSettlePackageAction(fd));
                }}
              >
                {t("rejectSettle")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("waitingAllocator")}</p>
          )}
        </SectionPanel>
      ) : null}

      <SectionPanel title={t("exportSection")}>
        <ReportExportBar
          report={report}
          filenameBase={`package-${pkg.name.slice(0, 40)}`}
        />
      </SectionPanel>

      <SectionPanel title={t("ledger")}>
        {transactions.length === 0 ? (
          <EmptyState>{t("emptyLedger")}</EmptyState>
        ) : (
          <ul className={cn(listDivideClass, "rounded-md border border-border")}>
            {transactions.map((tx) => (
              <li key={tx.id} className={cn(listRowClass, "flex flex-col gap-0.5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {tx.direction === "CREDIT" ? tWallet("credit") : tWallet("debit")}
                    {tx.kind ? ` · ${tx.kind}` : ""}
                    {tx.spendCategoryName ? ` · ${tx.spendCategoryName}` : ""}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums text-white",
                      tx.direction === "CREDIT"
                        ? "bg-emerald-600"
                        : "bg-rose-600",
                    )}
                  >
                    {tx.direction === "CREDIT" ? "+" : "−"}
                    {formatVndDigits(tx.amountVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(tx.createdAt)} · {tx.createdByName}
                  {tx.detail ? ` · ${tx.detail}` : tx.note ? ` · ${tx.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          emphasize && "text-primary",
        )}
      >
        {formatVndDigits(value)} ₫
      </p>
    </div>
  );
}
