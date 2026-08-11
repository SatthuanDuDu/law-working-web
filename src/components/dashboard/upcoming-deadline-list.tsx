"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ChevronDown,
  ClipboardList,
  Clock3,
  ListTodo,
} from "lucide-react";
import type { MatterPlanStepStatus } from "@prisma/client";
import { updateMatterPlanStepAction } from "@/lib/actions";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Select } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
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
  dueAt: string;
  dueLabel: string;
  matterCodeShort: string | null;
  person?: {
    id: string;
    name: string;
    avatarKey?: string | null;
    role: "leadLawyer" | "assignee";
  } | null;
  assignees?: {
    id: string;
    name: string;
    avatarKey?: string | null;
  }[];
};

function deadlineTime(item: UpcomingDeadlineItem) {
  if (item.kind === "plan") return new Date(item.dueAt).getTime();

  // Tasks use a date-only input, so their deadline is the end of that local day.
  const [year, month, day] = item.dueAt.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function priorityAccentClass(variant: UpcomingDeadlineItem["statusVariant"]) {
  switch (variant) {
    case "danger":
      return "border-l-rose-500";
    case "warning":
      return "border-l-amber-500";
    case "info":
      return "border-l-sky-500";
    default:
      return "border-l-border";
  }
}

function DeadlineCountdown({ item }: { item: UpcomingDeadlineItem }) {
  const t = useTranslations("dashboard");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const kickoff = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  if (now == null) return null;

  const remainingMs = deadlineTime(item) - now;
  const overdue = remainingMs <= 0;
  const totalMinutes = Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const value =
    days > 0
      ? t("countdownDaysHours", { days, hours })
      : hours > 0
        ? t("countdownHoursMinutes", { hours, minutes })
        : t("countdownMinutes", { minutes: totalMinutes });

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium tabular-nums",
        overdue
          ? "text-rose-600 dark:text-rose-300"
          : remainingMs <= 24 * 60 * 60 * 1_000
            ? "text-amber-700 dark:text-amber-300"
            : "text-muted-foreground",
      )}
      aria-label={overdue ? t("countdownOverdue", { value }) : t("countdownLeft", { value })}
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {overdue ? t("countdownOverdue", { value }) : t("countdownLeft", { value })}
    </span>
  );
}

export function UpcomingDeadlineList({
  items,
}: {
  items: UpcomingDeadlineItem[];
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tMatters = useTranslations("matters");
  const tPlan = useTranslations("plan");
  const tCalendar = useTranslations("calendar");
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
    <div className="min-w-0">
      {error ? (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      <ul className="min-w-0 space-y-4">
        {items.map((item) => {
          const showPlanSelect =
            item.kind === "plan" &&
            item.canEditPlan &&
            item.planStepId &&
            item.planStatus;
          const KindIcon = item.kind === "plan" ? ClipboardList : ListTodo;
          const kindLabel =
            item.kind === "plan" ? t("kindPlan") : t("kindTask");
          const personLabel =
            item.person?.role === "assignee"
              ? tPlan("assignee")
              : tCalendar("leadLawyer");

          return (
            <li
              key={item.key}
              className={cn(
                "group/deadline min-w-0 rounded-[var(--radius-md)] border border-transparent border-l-[3px] bg-transparent py-2.5 pl-3 pr-2.5",
                "transition-[background-color,border-color,box-shadow] duration-150 ease-out",
                "hover:border-y-border hover:border-r-border hover:bg-primary-muted-hover hover:shadow-[var(--shadow-card)]",
                "dark:hover:bg-primary-muted-hover",
                priorityAccentClass(item.statusVariant),
              )}
              title={
                item.kind === "task"
                  ? `${kindLabel} · ${item.statusLabel}`
                  : kindLabel
              }
            >
              <Link
                href={item.href}
                className="interactive-press block min-w-0 hover:[filter:none] active:[filter:none]"
              >
                <p className="break-words text-sm font-medium leading-snug text-foreground transition-colors group-hover/deadline:text-primary sm:text-[0.9375rem]">
                  {item.title}
                </p>
              </Link>

              <div className="mt-1.5 flex min-w-0 flex-col gap-1.5">
                <div className="flex min-w-0 items-start gap-2">
                  <Link
                    href={item.href}
                    className="interactive-press inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground hover:[filter:none] active:[filter:none]"
                  >
                    <KindIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">{kindLabel}</span>
                    <span className="min-w-0 truncate">
                      {item.dueLabel}
                      {item.matterCodeShort ? ` · ${item.matterCodeShort}` : ""}
                    </span>
                  </Link>
                  <DeadlineCountdown item={item} />
                </div>

                {item.assignees && item.assignees.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    {item.assignees.map((person, index) => (
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
                ) : item.person ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      userId={item.person.id}
                      name={item.person.name}
                      avatarKey={item.person.avatarKey}
                      size="sm"
                      className="h-6 w-6 text-[10px]"
                    />
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      <span className="text-muted-foreground/80">
                        {personLabel}:{" "}
                      </span>
                      {item.person.name}
                    </span>
                  </div>
                ) : null}

                {showPlanSelect ? (
                  <div className="relative w-fit max-w-full shrink-0">
                    <Select
                      value={item.planStatus}
                      disabled={isPending && pendingId === item.planStepId}
                      onChange={(event) =>
                        handlePlanStatusChange(
                          item.planStepId!,
                          event.target.value as MatterPlanStepStatus,
                        )
                      }
                      className="h-7 w-auto max-w-full min-w-[7.5rem] appearance-none rounded-md border-border/70 bg-transparent py-0 pl-2 pr-6 text-xs font-medium text-foreground shadow-none"
                      aria-label={`${tMatters("status")}: ${item.title}`}
                    >
                      {planStatuses.map((status) => (
                        <option key={status} value={status}>
                          {planStepStatus[status]}
                        </option>
                      ))}
                    </Select>
                    <ChevronDown
                      className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                ) : item.kind === "plan" ? (
                  <span className="text-xs text-muted-foreground">
                    {item.statusLabel}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
