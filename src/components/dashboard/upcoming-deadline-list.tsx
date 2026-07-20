"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { MatterPlanStepStatus } from "@prisma/client";
import { updateMatterPlanStepAction } from "@/lib/actions";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Badge, Select } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type UpcomingDeadlineItem = {
  key: string;
  title: string;
  href: string;
  kind: "task" | "plan";
  planStepId?: string;
  canEditPlan?: boolean;
  statusLabel: string;
  statusVariant: "default" | "info" | "warning" | "danger";
  planStatus?: MatterPlanStepStatus;
  dueLabel: string;
  matterCodeShort: string | null;
};

export function UpcomingDeadlineList({
  items,
}: {
  items: UpcomingDeadlineItem[];
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tMatters = useTranslations("matters");
  const { planStepStatus } = useLabelMaps();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const planStatuses = Object.keys(planStepStatus) as MatterPlanStepStatus[];

  function handlePlanStatusChange(
    stepId: string,
    status: MatterPlanStepStatus,
  ) {
    setError(null);
    setPendingId(stepId);
    const formData = new FormData();
    formData.set("id", stepId);
    formData.set("status", status);
    startTransition(async () => {
      const result = await updateMatterPlanStepAction(formData);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      {items.map((item) => {
        const showPlanSelect =
          item.kind === "plan" &&
          item.canEditPlan &&
          item.planStepId &&
          item.planStatus;

        return (
          <div
            key={item.key}
            className="rounded-md border border-primary/15 bg-primary-muted/40 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary-muted"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={item.href}
                className="interactive-press min-w-0 flex-1 hover:[filter:none] active:[filter:none]"
              >
                <p className="truncate font-medium text-foreground">
                  {item.title}
                </p>
              </Link>
              {showPlanSelect ? (
                <div className="relative shrink-0">
                  <Select
                    value={item.planStatus}
                    disabled={isPending && pendingId === item.planStepId}
                    onChange={(event) =>
                      handlePlanStatusChange(
                        item.planStepId!,
                        event.target.value as MatterPlanStepStatus,
                      )
                    }
                    className={cn(
                      "h-8 w-auto min-w-[8.5rem] appearance-none rounded-full border-border bg-surface py-0 pl-2.5 pr-7 text-center text-xs font-medium text-foreground shadow-none",
                    )}
                    aria-label={`${tMatters("status")}: ${item.title}`}
                  >
                    {planStatuses.map((status) => (
                      <option key={status} value={status}>
                        {planStepStatus[status]}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              ) : (
                <Badge variant={item.statusVariant} className="shrink-0">
                  {item.statusLabel}
                </Badge>
              )}
            </div>
            <Link
              href={item.href}
              className="interactive-press mt-1.5 flex min-w-0 items-center gap-1.5 hover:[filter:none] active:[filter:none]"
            >
              <Badge
                className={
                  item.kind === "plan"
                    ? "bg-primary-muted text-primary"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                }
              >
                {item.kind === "plan" ? t("kindPlan") : t("kindTask")}
              </Badge>
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {item.dueLabel}
                {item.matterCodeShort ? ` · ${item.matterCodeShort}` : ""}
              </p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
