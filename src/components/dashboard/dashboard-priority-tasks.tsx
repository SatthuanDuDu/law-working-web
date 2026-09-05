"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { formatDate, cn } from "@/lib/utils";
import type { DashboardTaskItem } from "@/components/dashboard/expandable-stat-card";
import type { TaskPriority } from "@prisma/client";

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

function priorityStripe(priority: TaskPriority, overdue: boolean) {
  if (overdue || priority === "URGENT") return "bg-rose-500";
  if (priority === "HIGH") return "bg-amber-500";
  return "bg-sky-500";
}

function taskHref(item: DashboardTaskItem) {
  return item.matterId ? `/matters/${item.matterId}` : "/tasks";
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const end = new Date(dueDate.slice(0, 10));
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

export function DashboardPriorityTasks({
  items,
  emptyLabel,
}: {
  items: DashboardTaskItem[];
  emptyLabel: string;
}) {
  const t = useTranslations("dashboard");
  const tCalendar = useTranslations("calendar");
  const labels = useLabelMaps();

  return (
    <SectionPanel
      title={t("priorityToday")}
      icon={<ListTodo className="h-4 w-4" />}
      action={
        <Link
          href="/tasks"
          className="interactive-link inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          {t("viewAllTasks")}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      }
      className="h-full"
    >
      {items.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-0.5">
          {items.slice(0, 6).map((item) => {
            const overdue = isOverdue(item.dueDate);
            return (
              <Link
                key={item.id}
                href={taskHref(item)}
                className="interactive-press group relative flex items-start gap-2 overflow-hidden rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-container-low"
              >
                <span
                  className={cn(
                    "absolute bottom-2 left-0 top-2 w-1 rounded-r-full",
                    priorityStripe(item.priority, overdue),
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 pl-2">
                  <div className="mb-1 flex min-w-0 items-center gap-2">
                    <Badge
                      variant={priorityVariant(item.priority)}
                      className="shrink-0"
                    >
                      {labels.taskPriority[item.priority]}
                    </Badge>
                    {item.dueDate ? (
                      <span
                        className={cn(
                          "inline-flex min-w-0 items-center gap-1 truncate text-[11px] font-medium",
                          overdue ? "text-rose-600" : "text-muted-foreground",
                        )}
                      >
                        <Clock3 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {tCalendar("dueAt", {
                            date: formatDate(item.dueDate),
                          })}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.matterCode ? `${item.matterCode} · ` : ""}
                    {labels.taskStatus[item.status]}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}
