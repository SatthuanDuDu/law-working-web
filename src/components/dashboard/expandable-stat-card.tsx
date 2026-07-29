"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { formatDate, cn } from "@/lib/utils";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import type { TaskPriority, TaskStatus } from "@prisma/client";

const STAT_TONES = {
  primary: "bg-primary-muted text-primary",
  sky: "bg-primary-muted text-primary",
  amber: "bg-primary-muted text-primary",
  accent: "bg-primary-muted text-primary",
} as const;

function priorityVariant(
  priority: TaskPriority,
): "default" | "info" | "warning" | "danger" {
  switch (priority) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "info";
    default:
      return "default";
  }
}

export type DashboardPerson = {
  id: string;
  name: string;
  avatarKey?: string | null;
};

export type DashboardTaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  matterId: string | null;
  matterCode: string | null;
  matterTitle: string | null;
  leadLawyer: DashboardPerson | null;
};

function taskHref(item: DashboardTaskItem) {
  return item.matterId ? `/matters/${item.matterId}` : "/tasks";
}

function shortenCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 18) return code;
  return `${code.slice(0, 8)}…${code.slice(-6)}`;
}

export function ExpandableStatCard({
  label,
  value,
  sub,
  icon,
  tone,
  items,
  emptyLabel,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  tone: keyof typeof STAT_TONES;
  items: DashboardTaskItem[];
  emptyLabel: string;
}) {
  const t = useTranslations("dashboard");
  const tCalendar = useTranslations("calendar");
  const labels = useLabelMaps();
  const [open, setOpen] = useState(false);

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
          {items.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className={listDivideClass}>
              {items.map((item) => {
                const matterLabel = shortenCode(item.matterCode);
                const detailParts = [
                  matterLabel,
                  labels.taskStatus[item.status],
                  tCalendar("dueAt", {
                    date: item.dueDate ? formatDate(item.dueDate) : "—",
                  }),
                ].filter(Boolean);

                return (
                  <Link
                    key={item.id}
                    href={taskHref(item)}
                    className={listRowClass}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <Badge
                        variant={priorityVariant(item.priority)}
                        className="shrink-0"
                      >
                        {labels.taskPriority[item.priority]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
                      {detailParts.join(" · ")}
                    </p>
                    {item.leadLawyer ? (
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <UserAvatar
                          userId={item.leadLawyer.id}
                          name={item.leadLawyer.name}
                          avatarKey={item.leadLawyer.avatarKey}
                          size="sm"
                          className="h-6 w-6 text-[10px]"
                        />
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          <span className="text-muted-foreground/80">
                            {tCalendar("leadLawyer")}:{" "}
                          </span>
                          {item.leadLawyer.name}
                        </span>
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
