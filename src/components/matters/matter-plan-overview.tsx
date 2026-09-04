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

  const showStatGrid = total >= 3;

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">{t("progressTitle")}</CardTitle>
        {total > 0 ? (
          <span className="text-sm font-medium text-muted-foreground">
            {t("completedPercent", { percent })}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {total > 0 ? (
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("completedPercent", { percent })}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                overdueCount > 0 && percent < 100 ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}

        {showStatGrid ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label={t("planSteps")} value={total} />
            <StatCell label={t("inProgress")} value={inProgress} tone="sky" />
            <StatCell label={t("done")} value={done} tone="emerald" />
            <StatCell label={t("blocked")} value={blocked} tone="rose" />
          </div>
        ) : total > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("stepSummary", {
              total,
              done,
              inProgress,
              waiting: blocked,
            })}
          </p>
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

        {overdueCount > 0 ? (
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
            {t("overdueCount", { count: overdueCount })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "sky" | "emerald" | "rose";
}) {
  const valueClass =
    tone === "sky"
      ? "text-sky-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : tone === "rose"
          ? "text-rose-600"
          : "text-foreground";

  return (
    <div className="rounded-md border border-border p-2.5 sm:p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl", valueClass)}>
        {value}
      </p>
    </div>
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
    <Card className="rounded-md">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">{t("timelineTitle")}</CardTitle>
        <Link
          href={`/matters/${matterId}/plan`}
          className="interactive-press text-sm font-medium text-primary hover:text-primary-hover"
        >
          {t("openPlan")} →
        </Link>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <EmptyState
            action={
              <Link href={`/matters/${matterId}/plan`}>
                <Button type="button" size="sm" className="interactive-press mt-1">
                  {t("addFirstStep")}
                </Button>
              </Link>
            }
          >
            {t("noSteps")}
          </EmptyState>
        ) : (
          <ol className="relative space-y-0">
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
