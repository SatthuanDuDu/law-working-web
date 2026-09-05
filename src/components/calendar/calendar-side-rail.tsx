"use client";

import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CalendarSideRail({
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  showTasks,
  showPlans,
  onToggleTasks,
  onTogglePlans,
  urgentItems,
  weekdayShort,
  labels,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  showTasks: boolean;
  showPlans: boolean;
  onToggleTasks: () => void;
  onTogglePlans: () => void;
  urgentItems: Array<{
    id: string;
    kind: "task" | "plan";
    title: string;
    whenLabel: string;
    matterLabel: string;
    href: string;
  }>;
  weekdayShort: string[];
  labels: {
    miniMonth: string;
    categories: string;
    selectAll: string;
    kindTask: string;
    kindPlan: string;
    urgentTitle: string;
    viewDetail: string;
  };
}) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-[15.5rem] lg:shrink-0 xl:w-[17rem]">
      <div className="rounded-2xl border border-border/70 bg-surface p-3.5 shadow-[var(--shadow-card)]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {labels.miniMonth}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              aria-label="prev"
              onClick={() => onMonthChange(subMonths(month, 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              aria-label="next"
              onClick={() => onMonthChange(addMonths(month, 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground">
          {weekdayShort.map((d, i) => (
            <span
              key={d}
              className={cn(
                "py-1",
                i === 5 && "font-semibold text-primary",
                i === 6 && "font-semibold text-rose-600",
              )}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const selected = selectedDay ? isSameDay(day, selectedDay) : false;
            const today = isSameDay(day, new Date());
            const dow = day.getDay();
            return (
              <button
                key={format(day, "yyyy-MM-dd")}
                type="button"
                onClick={() => {
                  onSelectDay(day);
                  if (!inMonth) onMonthChange(startOfMonth(day));
                }}
                className={cn(
                  "interactive-press rounded-full py-1 tabular-nums transition-colors",
                  !inMonth && "text-muted-foreground/50",
                  inMonth && dow === 0 && "text-rose-600",
                  inMonth && dow === 6 && "text-primary",
                  today && !selected && "font-bold ring-1 ring-inset ring-primary/40",
                  selected &&
                    "bg-primary font-bold text-primary-foreground shadow-sm",
                  !selected && inMonth && "hover:bg-surface-container",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-surface p-3.5 shadow-[var(--shadow-card)]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {labels.categories}
          </span>
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:underline"
            onClick={() => {
              if (!showTasks) onToggleTasks();
              if (!showPlans) onTogglePlans();
            }}
          >
            {labels.selectAll}
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface-container-low px-2.5 py-2 hover:bg-surface-container">
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              {labels.kindTask}
            </span>
            <input
              type="checkbox"
              checked={showTasks}
              onChange={onToggleTasks}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface-container-low px-2.5 py-2 hover:bg-surface-container">
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
              {labels.kindPlan}
            </span>
            <input
              type="checkbox"
              checked={showPlans}
              onChange={onTogglePlans}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </div>

      {urgentItems.length > 0 ? (
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/50 p-3.5 shadow-[var(--shadow-card)] dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-rose-700 dark:text-rose-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
            {labels.urgentTitle}
          </p>
          <div className="space-y-2">
            {urgentItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block rounded-xl border border-border/50 bg-surface p-2.5 shadow-sm transition-colors hover:border-primary/30"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">
                  {item.whenLabel}
                </p>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.matterLabel}
                </p>
                <span className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline">
                  {labels.viewDetail}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
