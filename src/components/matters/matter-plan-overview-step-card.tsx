"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import type { MatterPlanStepStatus, Role } from "@prisma/client";
import { UserAvatar } from "@/components/ui/user-avatar";
import { planStepStatusChipClass } from "@/components/ui/status-chip";
import { formatDate, cn } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useTranslations } from "next-intl";

export type OverviewStepCardData = {
  id: string;
  title: string;
  description: string | null;
  status: MatterPlanStepStatus;
  startedAt: string | null;
  dueAt: string | null;
  workTypeName: string | null;
  locationName: string | null;
  locationAddress: string | null;
  assignees: {
    id: string;
    name: string;
    avatarKey: string | null;
    role: Role;
  }[];
  attachmentCount: number;
  commentCount: number;
  index: number;
  isOverdue: boolean;
};

export function MatterPlanOverviewStepCard({
  matterId,
  step,
}: {
  matterId: string;
  step: OverviewStepCardData;
}) {
  const t = useTranslations("matters.overview");
  const tPlan = useTranslations("plan");
  const { planStepStatus, roles } = useLabelMaps();
  const [expanded, setExpanded] = useState(false);

  const workLabel = step.workTypeName ?? t("planFallback");
  const dateParts: string[] = [];
  if (step.startedAt) {
    dateParts.push(`${t("startLabel")}: ${formatDate(step.startedAt)}`);
  }
  if (step.dueAt) {
    dateParts.push(`${t("dueLabel")}: ${formatDate(step.dueAt)}`);
  }
  const dateLine = dateParts.length > 0 ? dateParts.join(" · ") : null;

  const detailText = step.description?.trim() ?? "";
  // Only show a separate description block when it adds info beyond the title
  // (legacy steps often stored the long text in `title` only).
  const showDetail =
    detailText.length > 0 && detailText !== step.title.trim();

  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      <span
        className={cn(
          "relative z-[1] mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 bg-surface text-[10px] font-bold tabular-nums",
          step.status === "DONE"
            ? "border-emerald-500 text-emerald-700"
            : step.status === "IN_PROGRESS"
              ? "border-amber-500 text-amber-700"
              : step.status === "BLOCKED"
                ? "border-rose-500 text-rose-700"
                : "border-border text-muted-foreground",
        )}
      >
        {step.index}
      </span>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-md border border-border",
          step.isOverdue &&
            "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20",
        )}
      >
        <div className="flex min-w-0 items-start gap-1 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <Link
                href={`/matters/${matterId}/plan?step=${step.id}`}
                className="interactive-press min-w-0 flex-1 break-words font-medium leading-snug text-foreground hover:text-primary hover:underline hover:underline-offset-2"
                aria-label={t("openStepAria", { title: step.title })}
              >
                {step.title}
              </Link>
              <span
                className={cn(
                  planStepStatusChipClass(step.status),
                  "shrink-0 px-2 py-0.5 text-[10px] font-semibold",
                )}
              >
                {planStepStatus[step.status]}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {workLabel}
              {dateLine ? ` · ${dateLine}` : ""}
              {step.isOverdue ? (
                <span className="ml-1 font-medium text-rose-600 dark:text-rose-400">
                  · {t("overdue")}
                </span>
              ) : null}
            </p>

            {step.assignees.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-1.5">
                {step.assignees.map((user) => (
                  <li
                    key={user.id}
                    className="flex min-w-0 max-w-full items-center gap-2"
                  >
                    <UserAvatar
                      userId={user.id}
                      name={user.name}
                      avatarKey={user.avatarKey}
                      size="sm"
                      className="h-6 w-6 shrink-0 text-[10px]"
                    />
                    <span className="min-w-0 truncate text-xs text-foreground">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {roles[user.role]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t("noAssignee")}</p>
            )}

            {(step.attachmentCount > 0 || step.commentCount > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {step.attachmentCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    {step.attachmentCount}
                  </span>
                ) : null}
                {step.commentCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    {step.commentCount}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <button
            type="button"
            className="interactive-press mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? t("collapseStep") : t("expandStep")}
            onClick={() => setExpanded((open) => !open)}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>

        {expanded ? (
          <div className="space-y-3 border-t border-border px-3 py-3">
            {showDetail ? (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {tPlan("detail")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {detailText}
                </p>
              </div>
            ) : null}

            <dl className="grid gap-2 sm:grid-cols-2">
              <DetailItem label={tPlan("workType")}>{workLabel}</DetailItem>
              <DetailItem label={tPlan("startedAt")}>
                {step.startedAt ? formatDate(step.startedAt) : "—"}
              </DetailItem>
              <DetailItem label={tPlan("dueAt")}>
                {step.dueAt ? formatDate(step.dueAt) : "—"}
              </DetailItem>
              <DetailItem label={tPlan("location")}>
                {step.locationName || step.locationAddress || "—"}
              </DetailItem>
            </dl>

            {step.assignees.length > 0 ? (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {tPlan("assignee")}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {step.assignees.map((user) => (
                    <li
                      key={user.id}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <UserAvatar
                        userId={user.id}
                        name={user.name}
                        avatarKey={user.avatarKey}
                        size="sm"
                        className="h-7 w-7 shrink-0 text-[10px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {roles[user.role]}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Link
              href={`/matters/${matterId}/plan?step=${step.id}`}
              className="interactive-press inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              {t("openPlan")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
