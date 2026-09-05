import Link from "next/link";
import type { MatterPlanStepStatus, Role } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import {
  MatterPlanOverviewStepCard,
  type OverviewStepCardData,
} from "@/components/matters/matter-plan-overview-step-card";

export type MatterPlanOverviewStep = {
  id: string;
  title: string;
  description: string | null;
  status: MatterPlanStepStatus;
  startedAt: Date | null;
  dueAt: Date | null;
  sortOrder: number;
  locationName: string | null;
  locationAddress: string | null;
  workType: { name: string } | null;
  assignees: {
    user: {
      id: string;
      name: string;
      avatarKey: string | null;
      role: Role;
    };
  }[];
  _count: { attachments: number; comments: number };
};

const SEGMENT_CLASS: Record<MatterPlanStepStatus, string> = {
  DONE: "bg-emerald-500",
  IN_PROGRESS: "bg-sky-500",
  BLOCKED: "bg-rose-500",
  NOT_STARTED: "bg-slate-300 dark:bg-slate-600",
};

const DOT_CLASS: Record<MatterPlanStepStatus, string> = {
  DONE: "border-emerald-500 bg-emerald-500 text-white",
  IN_PROGRESS:
    "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  BLOCKED:
    "border-rose-500 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  NOT_STARTED:
    "border-slate-300 bg-surface text-muted-foreground dark:border-slate-600",
};

/** Compact progress strip — no CTA (CTA lives on timeline header only). */
export async function MatterPlanProgress({
  planSteps,
  matterCreatedAt,
  referenceNow,
}: {
  planSteps: MatterPlanOverviewStep[];
  matterCreatedAt: Date;
  referenceNow: Date;
}) {
  const t = await getTranslations("matters.overview");

  const total = planSteps.length;
  const inProgress = planSteps.filter((s) => s.status === "IN_PROGRESS").length;
  const done = planSteps.filter((s) => s.status === "DONE").length;
  const blocked = planSteps.filter((s) => s.status === "BLOCKED").length;
  const notStarted = planSteps.filter((s) => s.status === "NOT_STARTED").length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const now = referenceNow.getTime();
  const overdueCount = planSteps.filter(
    (s) => s.dueAt != null && s.dueAt.getTime() < now && s.status !== "DONE",
  ).length;

  const startCandidates = planSteps
    .map((s) => s.startedAt)
    .filter((d): d is Date => d != null);
  const startAt =
    startCandidates.length > 0
      ? new Date(Math.min(...startCandidates.map((d) => d.getTime())))
      : matterCreatedAt;

  const dueDates = planSteps
    .map((s) => s.dueAt)
    .filter((d): d is Date => d != null);
  const endAt =
    dueDates.length > 0
      ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
      : null;

  const segments: { status: MatterPlanStepStatus; count: number }[] = [
    { status: "DONE", count: done },
    { status: "IN_PROGRESS", count: inProgress },
    { status: "BLOCKED", count: blocked },
    { status: "NOT_STARTED", count: notStarted },
  ];

  const statusPills: {
    status: MatterPlanStepStatus;
    count: number;
    label: string;
  }[] = [
    { status: "DONE", count: done, label: t("done") },
    { status: "IN_PROGRESS", count: inProgress, label: t("inProgress") },
    { status: "BLOCKED", count: blocked, label: t("blocked") },
    { status: "NOT_STARTED", count: notStarted, label: t("notStarted") },
  ];

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-[15px] font-bold">{t("progressTitle")}</CardTitle>
        {total > 0 ? (
          <span className="text-xl font-black tabular-nums text-primary">
            {percent}%
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {total > 0 ? (
          <>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-surface-container"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("completedPercent", { percent })}
            >
              {segments.map(({ status, count }) =>
                count > 0 ? (
                  <div
                    key={status}
                    className={cn("h-full min-w-0 transition-all", SEGMENT_CLASS[status])}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                ) : null,
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {statusPills.map(({ status, count, label }) => (
                <div
                  key={status}
                  className={cn(
                    "rounded-xl bg-surface-container-low p-2 text-center",
                    status === "BLOCKED" && count > 0 && "bg-rose-50 dark:bg-rose-950/30",
                  )}
                >
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                  <div
                    className={cn(
                      "text-base font-bold tabular-nums text-foreground",
                      status === "DONE" && "text-emerald-700 dark:text-emerald-300",
                      status === "IN_PROGRESS" && "text-primary",
                      status === "BLOCKED" && count > 0 && "text-rose-600",
                    )}
                  >
                    {count}
                  </div>
                </div>
              ))}
            </div>

            {overdueCount > 0 ? (
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {t("overdueCount", { count: overdueCount })}
              </div>
            ) : null}

            <ol
              className="flex flex-wrap items-center gap-1.5"
              aria-label={t("stepSequenceAria")}
            >
              {planSteps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <span
                      className="h-px w-2.5 shrink-0 bg-border sm:w-3.5"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
                      DOT_CLASS[step.status],
                    )}
                    title={`${index + 1}. ${step.title}`}
                  >
                    {index + 1}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {t("startLabel")}: {formatDate(startAt)}
          {endAt ? (
            <>
              {" "}
              · {t("dueLabel")}: {formatDate(endAt)}
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}

export async function MatterPlanOverview({
  matterId,
  planSteps,
  referenceNow,
}: {
  matterId: string;
  planSteps: MatterPlanOverviewStep[];
  referenceNow: Date;
}) {
  const t = await getTranslations("matters.overview");
  const now = referenceNow.getTime();

  const cards: OverviewStepCardData[] = planSteps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    status: step.status,
    startedAt: step.startedAt?.toISOString() ?? null,
    dueAt: step.dueAt?.toISOString() ?? null,
    workTypeName: step.workType?.name ?? null,
    locationName: step.locationName,
    locationAddress: step.locationAddress,
    assignees: step.assignees.map(({ user }) => user),
    attachmentCount: step._count.attachments,
    commentCount: step._count.comments,
    index: index + 1,
    isOverdue:
      step.dueAt != null &&
      step.dueAt.getTime() < now &&
      step.status !== "DONE",
  }));

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-lg font-bold">{t("timelineTitle")}</CardTitle>
          <p className="text-[13px] font-normal text-muted-foreground">
            {t("timelineHint")}
          </p>
        </div>
        <Button asChild size="sm" className="rounded-full">
          <Link href={`/matters/${matterId}/plan`}>
            {t("openPlan")} →
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <EmptyState
            action={
              <Link href={`/matters/${matterId}/plan`}>
                <Button type="button" size="sm" className="interactive-press mt-1 rounded-full">
                  {t("addFirstStep")}
                </Button>
              </Link>
            }
          >
            {t("noSteps")}
          </EmptyState>
        ) : (
          <ol className="relative space-y-3">
            {cards.map((step) => (
              <MatterPlanOverviewStepCard
                key={step.id}
                matterId={matterId}
                step={step}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
