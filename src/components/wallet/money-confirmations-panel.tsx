"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";
import {
  finalizeMoneyConfirmationAction,
  respondMoneyConfirmationAction,
  type MoneyConfirmationListItem,
} from "@/lib/money-confirmation-actions";
import { decideSettlePackageAction } from "@/lib/budget-package-actions";
import { formatVndDigits } from "@/lib/wallet";

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

export function MoneyConfirmationsPanel({
  confirmations,
  id = "confirmations",
}: {
  confirmations: MoneyConfirmationListItem[];
  id?: string;
}) {
  const t = useTranslations("moneyConfirm");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function runAction(
    confirmationId: string,
    fn: () => Promise<{ error?: string }>,
  ) {
    setError("");
    setPendingId(confirmationId);
    startTransition(async () => {
      const result = await fn();
      setPendingId(null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDisputeId(null);
      setDisputeNote("");
      router.refresh();
    });
  }

  if (confirmations.length === 0) {
    return null;
  }

  return (
    <section
      id={id}
      className="space-y-4 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {t("title")}
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({confirmations.length})
            </span>
          </h2>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {t("actionNeeded")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t("actionHint")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {confirmations.map((c) => {
          const busy = pendingId === c.id;
          const kindLabel =
            c.kind === "BUDGET_ALLOCATE"
              ? t("kindBudget")
              : c.kind === "BUDGET_TOPUP"
                ? t("kindTopup")
                : c.kind === "PACKAGE_SETTLE"
                  ? t("kindSettle")
                  : t("kindClient");

          return (
            <article
              key={c.id}
              className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3.5 transition-colors hover:bg-surface-container sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-foreground">
                  <Inbox className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {kindLabel} · {t(`status.${c.status}`)}
                    </span>
                    {c.budgetPackageName ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
                        {c.budgetPackageName}
                      </span>
                    ) : null}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatWhen(c.createdAt)}</span>
                    <span aria-hidden>•</span>
                    <span>
                      {t("flow")}:{" "}
                      <strong className="font-medium text-foreground">
                        {c.fromUserName} → {c.toUserName}
                      </strong>
                    </span>
                    {c.matterCode ? (
                      <>
                        <span aria-hidden>•</span>
                        <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px]">
                          {c.matterCode}
                          {c.planStepTitle ? ` / ${c.planStepTitle}` : ""}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {c.note ? (
                    <p className="text-sm text-foreground/90">{c.note}</p>
                  ) : null}
                  {c.disputeNote ? (
                    <p className="text-sm text-rose-700">
                      {t("disputeNote")}: {c.disputeNote}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <p className="text-lg font-bold tabular-nums text-primary sm:text-right">
                  +{formatVndDigits(c.amountVnd)} ₫
                </p>

                {c.myAction === "recipient" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="interactive-press rounded-full"
                        disabled={busy}
                        onClick={() =>
                          runAction(c.id, async () => {
                            const fd = new FormData();
                            fd.set("confirmationId", c.id);
                            fd.set("response", "ACCEPT");
                            return respondMoneyConfirmationAction(fd);
                          })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {t("accept")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="interactive-press rounded-full"
                        disabled={busy}
                        onClick={() =>
                          runAction(c.id, async () => {
                            const fd = new FormData();
                            fd.set("confirmationId", c.id);
                            fd.set("response", "REJECT");
                            return respondMoneyConfirmationAction(fd);
                          })
                        }
                      >
                        {t("reject")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="interactive-press rounded-full"
                        disabled={busy}
                        onClick={() =>
                          setDisputeId(disputeId === c.id ? null : c.id)
                        }
                      >
                        {t("dispute")}
                      </Button>
                    </div>
                    {disputeId === c.id ? (
                      <div className="space-y-2 rounded-xl border border-border bg-surface p-2.5">
                        <Label htmlFor={`dispute-${c.id}`}>
                          {t("disputeNote")}
                        </Label>
                        <Input
                          id={`dispute-${c.id}`}
                          value={disputeNote}
                          onChange={(e) => setDisputeNote(e.target.value)}
                          placeholder={t("disputePlaceholder")}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="interactive-press rounded-full"
                          disabled={busy || !disputeNote.trim()}
                          onClick={() =>
                            runAction(c.id, async () => {
                              const fd = new FormData();
                              fd.set("confirmationId", c.id);
                              fd.set("response", "DISPUTE");
                              fd.set("disputeNote", disputeNote);
                              return respondMoneyConfirmationAction(fd);
                            })
                          }
                        >
                          {t("submitDispute")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {c.myAction === "allocator" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="interactive-press rounded-full"
                    disabled={busy}
                    onClick={() =>
                      runAction(c.id, async () => {
                        const fd = new FormData();
                        fd.set("confirmationId", c.id);
                        return finalizeMoneyConfirmationAction(fd);
                      })
                    }
                  >
                    {t("finalize")}
                  </Button>
                ) : null}

                {c.myAction === "settle_approver" ? (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="interactive-press rounded-full"
                      disabled={busy}
                      onClick={() =>
                        runAction(c.id, async () => {
                          const fd = new FormData();
                          fd.set("confirmationId", c.id);
                          fd.set("decision", "APPROVE");
                          return decideSettlePackageAction(fd);
                        })
                      }
                    >
                      {t("approveSettle")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="interactive-press rounded-full"
                      disabled={busy}
                      onClick={() =>
                        runAction(c.id, async () => {
                          const fd = new FormData();
                          fd.set("confirmationId", c.id);
                          fd.set("decision", "REJECT");
                          return decideSettlePackageAction(fd);
                        })
                      }
                    >
                      {t("rejectSettle")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
