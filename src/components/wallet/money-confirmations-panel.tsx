"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { EmptyState } from "@/components/ui/empty-state";
import {
  finalizeMoneyConfirmationAction,
  respondMoneyConfirmationAction,
  type MoneyConfirmationListItem,
} from "@/lib/money-confirmation-actions";
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

  function runAction(confirmationId: string, fn: () => Promise<{ error?: string }>) {
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

  return (
    <div id={id}>
      <SectionPanel title={t("title")}>
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      {confirmations.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className={cn(listDivideClass, "rounded-md border border-border")}>
          {confirmations.map((c) => {
            const busy = pendingId === c.id;
            return (
              <li key={c.id} className={cn(listRowClass, "flex flex-col gap-2")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {c.kind === "BUDGET_ALLOCATE"
                      ? t("kindBudget")
                      : t("kindClient")}
                    {" · "}
                    {t(`status.${c.status}`)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatVndDigits(c.amountVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(c.createdAt)}
                  {" · "}
                  {c.fromUserName} → {c.toUserName}
                  {c.matterCode
                    ? ` · ${c.matterCode}${c.planStepTitle ? ` / ${c.planStepTitle}` : ""}`
                    : ""}
                </p>
                {c.note ? (
                  <p className="text-sm text-foreground/90">{c.note}</p>
                ) : null}
                {c.disputeNote ? (
                  <p className="text-sm text-rose-700">
                    {t("disputeNote")}: {c.disputeNote}
                  </p>
                ) : null}

                {c.myAction === "recipient" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="interactive-press"
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
                        {t("accept")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="interactive-press"
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
                        className="interactive-press"
                        disabled={busy}
                        onClick={() =>
                          setDisputeId(disputeId === c.id ? null : c.id)
                        }
                      >
                        {t("dispute")}
                      </Button>
                    </div>
                    {disputeId === c.id ? (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
                        <Label htmlFor={`dispute-${c.id}`}>{t("disputeNote")}</Label>
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
                          className="interactive-press"
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
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      className="interactive-press"
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
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      </SectionPanel>
    </div>
  );
}
