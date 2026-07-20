"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { formatDate, cn } from "@/lib/utils";
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

export type DashboardTaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  matterId: string | null;
  matterCode: string | null;
  matterTitle: string | null;
};

function taskHref(item: DashboardTaskItem) {
  return item.matterId ? `/matters/${item.matterId}` : "/tasks";
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
    <div className="glass-surface group rounded-md border border-[color:var(--glass-border)] p-5 transition-colors duration-200 hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("collapseCard", { label }) : t("expandCard", { label })}
            className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md",
              STAT_TONES[tone],
            )}
          >
            {icon}
          </span>
        </div>
      </div>
      <p className="mt-4 text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
        {value}
      </p>
      {sub ? <div className="mt-2 text-sm">{sub}</div> : null}

      {open ? (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={taskHref(item)}
                className="interactive-press block rounded-md border border-border/70 bg-surface/50 px-3 py-2.5 hover:border-primary/30 hover:bg-primary-muted/40 hover:[filter:none] active:[filter:none]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <Badge variant={priorityVariant(item.priority)} className="shrink-0">
                    {labels.taskPriority[item.priority]}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {labels.taskStatus[item.status]}
                  {" · "}
                  {tCalendar("dueAt", {
                    date: item.dueDate ? formatDate(item.dueDate) : "—",
                  })}
                  {item.matterCode ? ` · ${item.matterCode}` : ""}
                </p>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
