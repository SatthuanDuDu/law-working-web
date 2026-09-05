"use client";

import Link from "next/link";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 56;
/** Visual block height for point-in-time deadlines (no end time in data). */
const BLOCK_MINUTES = 40;

function useNowMs(intervalMs = 60_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    function update() {
      setCoarse(mq.matches || window.innerWidth < 768);
    }
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return coarse;
}

export type WeekGridTask = {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  matterId?: string | null;
  matterTitle?: string | null;
  matterCode?: string | null;
  clientName?: string | null;
  assigneeName: string;
};

export type WeekGridPlan = {
  id: string;
  title: string;
  dueAt: string;
  priority: string;
  matterId: string;
  matterCode: string;
  matterTitle: string;
  assigneeName: string | null;
};

function isUrgent(dueIso: string, priority: string, nowMs: number) {
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return false;
  if (priority === "URGENT" || priority === "HIGH") {
    if (due >= nowMs && due <= nowMs + 7 * 24 * 60 * 60 * 1000) return true;
  }
  return due >= nowMs && due <= nowMs + 2 * 60 * 60 * 1000;
}

type PlacedEvent = {
  key: string;
  kind: "task" | "plan";
  title: string;
  href: string;
  start: Date;
  urgent: boolean;
  subtitle: string;
  assignee: string;
  allDay: boolean;
  topPx: number;
  heightPx: number;
};

function placeEvent(
  start: Date,
  opts: Omit<PlacedEvent, "start" | "allDay" | "topPx" | "heightPx">,
): PlacedEvent {
  const hours = start.getHours() + start.getMinutes() / 60;
  const allDay = hours < HOUR_START || hours >= HOUR_END;
  if (allDay) {
    return {
      ...opts,
      start,
      allDay: true,
      topPx: 0,
      heightPx: 0,
    };
  }
  const topPx = (hours - HOUR_START) * HOUR_PX;
  const heightPx = (BLOCK_MINUTES / 60) * HOUR_PX;
  return { ...opts, start, allDay: false, topPx, heightPx };
}

function WeekEventCard({
  ev,
  kindLabel,
  matterLabel,
  assigneeLabel,
  scheduleLabel,
  dueSoonLabel,
}: {
  ev: PlacedEvent;
  kindLabel: string;
  matterLabel: string;
  assigneeLabel: string;
  scheduleLabel: string;
  dueSoonLabel: string;
}) {
  const coarse = useIsCoarsePointer();
  const rootRef = useRef<HTMLAnchorElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const tipW = 280;
    const tipH = tipRef.current?.offsetHeight ?? 160;
    const gap = 8;
    let left = rect.right + gap;
    if (left + tipW > window.innerWidth - 8) {
      left = rect.left - tipW - gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    let top = rect.top;
    top = Math.max(8, Math.min(top, window.innerHeight - tipH - 8));
    setStyle({ top, left, width: tipW, maxHeight: window.innerHeight - 16 });
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  function show() {
    if (coarse) return;
    setOpen(true);
  }
  function hide() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 120);
  }

  const timeLabel = format(ev.start, "HH:mm");

  return (
    <>
      <Link
        ref={rootRef}
        href={ev.href}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          "interactive-press group/ev absolute inset-x-0.5 z-[1] overflow-hidden rounded-md border border-border/70 bg-surface",
          "pl-1.5 pr-1.5 pt-1 pb-1 shadow-none transition-[box-shadow,border-color,background-color] duration-150",
          "hover:z-[3] hover:border-primary/35 hover:bg-primary-muted/40 hover:shadow-[var(--shadow-card)]",
          "focus-visible:z-[3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          ev.urgent &&
            "border-rose-300/80 bg-rose-50 hover:bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/30",
        )}
        style={{
          top: ev.topPx + 1,
          height: Math.max(ev.heightPx - 2, 34),
        }}
      >
        <span
          className={cn(
            "absolute inset-y-1 left-0 w-[3px] rounded-full",
            ev.urgent
              ? "bg-rose-600"
              : ev.kind === "plan"
                ? "bg-sky-600"
                : "bg-primary",
          )}
          aria-hidden
        />
        <div className="min-w-0 pl-1.5">
          <p className="flex min-w-0 items-baseline gap-1 text-[10px] leading-none">
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                ev.urgent ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
              )}
            >
              {timeLabel}
            </span>
            <span
              className={cn(
                "min-w-0 truncate font-semibold",
                ev.urgent
                  ? "text-rose-950 dark:text-rose-50"
                  : "text-foreground",
              )}
            >
              {ev.title}
            </span>
          </p>
          {ev.heightPx >= 40 && ev.subtitle ? (
            <p className="mt-0.5 truncate text-[9px] leading-tight text-muted-foreground">
              {ev.subtitle}
            </p>
          ) : null}
        </div>
      </Link>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              style={style}
              onMouseEnter={show}
              onMouseLeave={hide}
              className={cn(
                "fixed z-[80] overflow-hidden rounded-xl border border-border/80 bg-surface p-3 shadow-[var(--shadow-overlay)] transition-opacity duration-150",
                visible ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      ev.kind === "plan"
                        ? "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
                        : "bg-primary-muted text-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        ev.kind === "plan" ? "bg-sky-600" : "bg-primary",
                      )}
                    />
                    {kindLabel}
                  </span>
                  {ev.urgent ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {dueSoonLabel}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {ev.title}
                </p>
                <dl className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0">{scheduleLabel}</dt>
                    <dd className="min-w-0 font-medium tabular-nums text-foreground">
                      {format(ev.start, "dd/MM/yyyy HH:mm")}
                    </dd>
                  </div>
                  {ev.subtitle ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0">{matterLabel}</dt>
                      <dd className="min-w-0 font-medium text-foreground">
                        {ev.subtitle}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0">{assigneeLabel}</dt>
                    <dd className="min-w-0 font-medium text-foreground">
                      {ev.assignee}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function CalendarWeekGrid({
  weekAnchor,
  weekdayLabels,
  tasksByDay,
  plansByDay,
  todayLabel,
  allDayLabel,
  timezoneLabel,
}: {
  weekAnchor: Date;
  weekdayLabels: string[];
  tasksByDay: Map<string, WeekGridTask[]>;
  plansByDay: Map<string, WeekGridPlan[]>;
  todayLabel: string;
  allDayLabel: string;
  timezoneLabel: string;
}) {
  const t = useTranslations("calendar");
  const nowMs = useNowMs(60_000);
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );
  const gridHeight = hours.length * HOUR_PX;

  const columns = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const timed: PlacedEvent[] = [];
    const allDay: PlacedEvent[] = [];

    for (const task of tasksByDay.get(key) ?? []) {
      const matterLine = task.matterTitle
        ? `${task.matterCode ? `${task.matterCode} · ` : ""}${task.matterTitle}`
        : (task.clientName ?? "");
      const placed = placeEvent(new Date(task.dueDate), {
        key: `task-${task.id}`,
        kind: "task",
        title: task.title,
        href: task.matterId ? `/matters/${task.matterId}` : "/tasks",
        urgent: isUrgent(task.dueDate, task.priority, nowMs),
        subtitle: matterLine,
        assignee: task.assigneeName,
      });
      (placed.allDay ? allDay : timed).push(placed);
    }
    for (const step of plansByDay.get(key) ?? []) {
      const placed = placeEvent(new Date(step.dueAt), {
        key: `plan-${step.id}`,
        kind: "plan",
        title: step.title,
        href: `/matters/${step.matterId}/plan`,
        urgent: isUrgent(step.dueAt, step.priority, nowMs),
        subtitle: `${step.matterCode} · ${step.matterTitle}`,
        assignee: step.assigneeName ?? "—",
      });
      (placed.allDay ? allDay : timed).push(placed);
    }

    timed.sort((a, b) => a.topPx - b.topPx);
    return { day, key, timed, allDay, isToday: isSameDay(day, new Date()) };
  });

  const maxAllDay = Math.max(1, ...columns.map((c) => c.allDay.length));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-w-[720px]">
          <div className="sticky top-0 z-10 grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border/70 bg-surface">
            <div className="flex items-end justify-center pb-2 text-[10px] font-medium text-muted-foreground">
              {timezoneLabel}
            </div>
            {columns.map(({ day, isToday }, idx) => (
              <div
                key={columns[idx].key}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-l border-border/50 px-1 py-2",
                  isToday && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {weekdayLabels[idx]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center text-sm font-bold tabular-nums",
                    isToday
                      ? "rounded-full bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {isToday ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-primary">
                    {todayLabel}
                  </span>
                ) : (
                  <span className="h-2.5" />
                )}
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border/60 bg-surface-container-low/40"
            style={{ minHeight: maxAllDay * 22 + 6 }}
          >
            <div className="flex items-start justify-center pt-1 text-[10px] font-medium text-muted-foreground">
              {allDayLabel}
            </div>
            {columns.map((col) => (
              <div
                key={`allday-${col.key}`}
                className="space-y-0.5 border-l border-border/40 px-0.5 py-1"
              >
                {col.allDay.map((ev) => (
                  <Link
                    key={ev.key}
                    href={ev.href}
                    title={ev.title}
                    className={cn(
                      "interactive-press block truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                      ev.urgent
                        ? "bg-rose-600 text-white"
                        : ev.kind === "plan"
                          ? "bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100"
                          : "bg-primary-muted text-primary",
                    )}
                  >
                    {format(ev.start, "HH:mm")} · {ev.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div
            className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
            style={{ height: gridHeight }}
          >
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground"
                  style={{ top: (h - HOUR_START) * HOUR_PX }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {columns.map((col) => (
              <div
                key={`col-${col.key}`}
                className={cn(
                  "relative border-l border-border/50",
                  col.isToday && "bg-primary/[0.03]",
                )}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/35"
                    style={{ top: (h - HOUR_START) * HOUR_PX }}
                  />
                ))}
                {col.timed.map((ev) => (
                  <WeekEventCard
                    key={ev.key}
                    ev={ev}
                    kindLabel={
                      ev.kind === "plan" ? t("kindPlan") : t("kindTask")
                    }
                    matterLabel={t("taskMatter")}
                    assigneeLabel={t("assignee")}
                    scheduleLabel={t("taskSchedule")}
                    dueSoonLabel={t("dueSoon")}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
