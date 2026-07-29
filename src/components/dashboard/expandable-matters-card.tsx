"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { formatDate, cn } from "@/lib/utils";
import { liquidPanelClass } from "@/lib/liquid-panel";
import {
  listDivideClass,
  listNestedClass,
  listNestedRowClass,
  listRowButtonClass,
} from "@/lib/list-surface";
import type { MatterPlanStepStatus, MatterStatus } from "@prisma/client";
import type { DashboardPerson } from "@/components/dashboard/expandable-stat-card";

const STAT_TONES = {
  primary: "bg-primary-muted text-primary",
  sky: "bg-primary-muted text-primary",
} as const;

const MATTER_STATUS_CHIP: Record<MatterStatus, string> = {
  NEW: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  IN_PROGRESS: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  ON_HOLD: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  CLOSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  ARCHIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const PLAN_STATUS_CHIP: Record<MatterPlanStepStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  BLOCKED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

export type DashboardMatterPlanStep = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  dueAt: string | null;
  sortOrder: number;
  assignees: DashboardPerson[];
};

export type DashboardMatterItem = {
  id: string;
  code: string;
  title: string;
  status: MatterStatus;
  clientName: string | null;
  leadLawyer: DashboardPerson | null;
  planSteps: DashboardMatterPlanStep[];
};

function PersonRow({
  person,
  label,
}: {
  person: DashboardPerson;
  label: string;
}) {
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2">
      <UserAvatar
        userId={person.id}
        name={person.name}
        avatarKey={person.avatarKey}
        size="sm"
        className="h-6 w-6 text-[10px]"
      />
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        <span className="text-muted-foreground/80">{label}: </span>
        {person.name}
      </span>
    </div>
  );
}

export function ExpandableMattersCard({
  label,
  value,
  sub,
  icon,
  tone = "sky",
  matters,
  emptyLabel,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: keyof typeof STAT_TONES;
  matters: DashboardMatterItem[];
  emptyLabel: string;
}) {
  const t = useTranslations("dashboard");
  const tCalendar = useTranslations("calendar");
  const tPlan = useTranslations("plan");
  const labels = useLabelMaps();
  const [open, setOpen] = useState(false);
  const [expandedMatterId, setExpandedMatterId] = useState<string | null>(null);

  function toggleMatter(matterId: string) {
    setExpandedMatterId((current) => (current === matterId ? null : matterId));
  }

  return (
    <div
      className={cn(
        liquidPanelClass,
        "group min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-200 hover:border-primary/30",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("collapseCard", { label }) : t("expandCard", { label })}
        className="interactive-press flex w-full min-w-0 max-w-full items-center gap-2 p-3 text-left hover:[filter:none] active:[filter:none] sm:p-4"
      >
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-2xl font-bold leading-none tabular-nums text-foreground">
              {value}
            </p>
            {sub ? (
              <div className="min-w-0 text-xs sm:text-sm">{sub}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              STAT_TONES[tone],
            )}
          >
            {icon}
          </span>
        </div>
      </button>

      {open ? (
        <div className="min-w-0 border-t border-border/60 px-1.5 pb-2 pt-0 sm:px-2">
          {matters.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className={listDivideClass}>
              {matters.map((matter) => {
                const matterOpen = expandedMatterId === matter.id;
                const openPlans = matter.planSteps.filter(
                  (step) => step.status !== "DONE",
                ).length;
                const codeLabel =
                  matter.code.length > 18
                    ? `${matter.code.slice(0, 8)}…${matter.code.slice(-6)}`
                    : matter.code;
                const metaParts = [
                  codeLabel,
                  matter.clientName,
                  t("planStepCount", { count: matter.planSteps.length }),
                  openPlans > 0 && openPlans !== matter.planSteps.length
                    ? t("openPlanStepCount", { count: openPlans })
                    : null,
                ].filter(Boolean);

                return (
                  <div key={matter.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleMatter(matter.id)}
                      aria-expanded={matterOpen}
                      aria-label={
                        matterOpen
                          ? t("collapseMatterPlans", { title: matter.title })
                          : t("expandMatterPlans", { title: matter.title })
                      }
                      className={listRowButtonClass}
                    >
                      <ChevronRight
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          matterOpen && "rotate-90",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {matter.title}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              MATTER_STATUS_CHIP[matter.status],
                            )}
                          >
                            {labels.matterStatus[matter.status]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {metaParts.join(" · ")}
                        </p>
                        {matter.leadLawyer ? (
                          <PersonRow
                            person={matter.leadLawyer}
                            label={tCalendar("leadLawyer")}
                          />
                        ) : null}
                      </div>
                    </button>

                    {matterOpen ? (
                      <div className={cn(listNestedClass, "mb-2 mr-1")}>
                        {matter.planSteps.length === 0 ? (
                          <p className="py-1.5 text-xs text-muted-foreground">
                            {t("noPlanSteps")}
                          </p>
                        ) : (
                          matter.planSteps.map((step, index) => (
                            <Link
                              key={step.id}
                              href={`/matters/${matter.id}/plan`}
                              className={listNestedRowClass}
                            >
                              <span className="mt-0.5 w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                                    {step.title}
                                  </p>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                      PLAN_STATUS_CHIP[step.status],
                                    )}
                                  >
                                    {labels.planStepStatus[step.status]}
                                  </span>
                                </div>
                                {step.dueAt ? (
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {t("planDue", {
                                      date: formatDate(step.dueAt),
                                    })}
                                  </p>
                                ) : null}
                                {step.assignees.length > 0 ? (
                                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                    {step.assignees.map((person, index) => (
                                      <div
                                        key={person.id}
                                        className="flex min-w-0 max-w-full items-center gap-2"
                                      >
                                        <UserAvatar
                                          userId={person.id}
                                          name={person.name}
                                          avatarKey={person.avatarKey}
                                          size="sm"
                                          className="h-6 w-6 shrink-0 text-[10px]"
                                        />
                                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                                          {index === 0 ? (
                                            <span className="text-muted-foreground/80">
                                              {tPlan("assignee")}:{" "}
                                            </span>
                                          ) : null}
                                          {person.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </Link>
                          ))
                        )}
                        <Link
                          href={`/matters/${matter.id}/plan`}
                          className="interactive-link mt-1 inline-flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-primary"
                        >
                          {t("viewMatterPlan")}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
