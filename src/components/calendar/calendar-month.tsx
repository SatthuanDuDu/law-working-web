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
  setMonth as setMonthIndex,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: format(new Date(2020, index, 1), "MMMM", { locale: vi }),
}));

type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: keyof typeof TASK_STATUS_LABELS;
  priority: keyof typeof TASK_PRIORITY_LABELS;
  assigneeName: string;
  matterId?: string | null;
  matterCode?: string | null;
  matterTitle?: string | null;
  clientName?: string | null;
  leadLawyerName?: string | null;
  collaboratorNames?: string[];
};

/** Soft Material tonal chips by task priority: thấp / vừa / cao */
const TASK_PRIORITY_CHIP_CLASS: Record<keyof typeof TASK_PRIORITY_LABELS, string> = {
  LOW: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80",
  MEDIUM: "bg-amber-100 text-amber-900 hover:bg-amber-200/80",
  HIGH: "bg-orange-100 text-orange-900 hover:bg-orange-200/80",
  URGENT: "bg-rose-100 text-rose-900 hover:bg-rose-200/80",
};

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

function TaskPreviewContent({ task }: { task: CalendarTask }) {
  return (
    <dl className="mt-2 space-y-2 text-sm">
      <div>
        <dt className="text-xs text-slate-500">Khách hàng</dt>
        <dd className="font-medium text-slate-900">{task.clientName || "—"}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Tên vụ việc</dt>
        <dd className="font-medium text-slate-900">
          {task.matterTitle
            ? `${task.matterCode ? `${task.matterCode} · ` : ""}${task.matterTitle}`
            : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Chi tiết nhiệm vụ</dt>
        <dd className="text-slate-700">
          <p className="font-medium text-slate-900">{task.title}</p>
          {task.description ? (
            <p className="mt-0.5 text-slate-600">{task.description}</p>
          ) : null}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Thời gian diễn ra</dt>
        <dd className="font-medium text-slate-900">
          Hạn {format(new Date(task.dueDate), "HH:mm · dd/MM/yyyy")}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Mức độ ưu tiên</dt>
        <dd>
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
              TASK_PRIORITY_CHIP_CLASS[task.priority],
            )}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
        </dd>
      </div>
      <div className="border-t border-slate-100 pt-2">
        <dt className="text-[10px] text-slate-500">Luật sư chính</dt>
        <dd className="text-[11px] text-slate-700">{task.leadLawyerName || "—"}</dd>
      </div>
      <div>
        <dt className="text-[10px] text-slate-500">Cộng tác</dt>
        <dd className="text-[11px] text-slate-700">
          {task.collaboratorNames && task.collaboratorNames.length > 0
            ? task.collaboratorNames.join(", ")
            : "—"}
        </dd>
      </div>
    </dl>
  );
}

function TaskPreviewChip({ task }: { task: CalendarTask }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const coarse = useIsCoarsePointer();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; side: "left" | "right" } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  function measure() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = 280;
    const gap = 16;
    const spaceRight = window.innerWidth - rect.right - gap;
    const spaceLeft = rect.left - gap;
    const side: "left" | "right" =
      spaceRight >= width || spaceRight >= spaceLeft ? "right" : "left";
    const left =
      side === "right"
        ? Math.min(rect.right + gap, window.innerWidth - width - 8)
        : Math.max(8, rect.left - width - gap);
    const estimatedHeight = 220;
    const top = Math.min(
      Math.max(8, rect.top),
      window.innerHeight - estimatedHeight - 8,
    );
    return { top, left, side };
  }

  function showPopup() {
    clearTimers();
    if (coarse) {
      setOpen(true);
      requestAnimationFrame(() => setVisible(true));
      return;
    }
    const next = measure();
    if (!next) return;
    setBox(next);
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }

  function hidePopup() {
    clearTimers();
    if (coarse) {
      setVisible(false);
      hideTimer.current = setTimeout(() => {
        setOpen(false);
      }, 180);
      return;
    }
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      hideTimer.current = setTimeout(() => {
        setOpen(false);
        setBox(null);
      }, 180);
    }, 100);
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!open || !coarse) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      clearTimers();
      setVisible(false);
      hideTimer.current = setTimeout(() => setOpen(false), 180);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, coarse]);

  const href = task.matterId ? `/matters/${task.matterId}` : null;
  const chipClass = cn(
    "interactive-press block w-full truncate rounded px-1 py-0.5 text-[10px] sm:px-1.5 sm:text-[11px]",
    TASK_PRIORITY_CHIP_CLASS[task.priority],
  );

  return (
    <>
      <div
        ref={rootRef}
        className="relative"
        onMouseEnter={coarse ? undefined : showPopup}
        onMouseLeave={coarse ? undefined : hidePopup}
        onFocus={coarse ? undefined : showPopup}
        onBlur={coarse ? undefined : hidePopup}
      >
        {coarse ? (
          <button type="button" className={chipClass} onClick={showPopup}>
            {task.title}
          </button>
        ) : href ? (
          <Link href={href} className={chipClass}>
            {task.title}
          </Link>
        ) : (
          <div className={chipClass}>{task.title}</div>
        )}
      </div>
      {open && coarse
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-end justify-center">
              <button
                type="button"
                aria-label="Đóng"
                className={cn(
                  "absolute inset-0 bg-slate-900/40 transition-opacity duration-200",
                  visible ? "opacity-100" : "opacity-0",
                )}
                onClick={hidePopup}
              />
              <div
                role="dialog"
                aria-label="Tổng quan nhiệm vụ"
                className={cn(
                  "relative z-[1] max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white p-4 shadow-[var(--shadow-overlay)] transition-all duration-200",
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tổng quan nhiệm vụ
                </p>
                <TaskPreviewContent task={task} />
                {href ? (
                  <Link
                    href={href}
                    className="interactive-press mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white"
                    onClick={hidePopup}
                  >
                    Xem vụ việc
                  </Link>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
      {open && box && !coarse
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: box.top, left: box.left, width: 280 }}
              className={cn(
                "fixed z-[70] rounded-[5px] border border-slate-200/80 bg-white p-3 transition-all duration-200 ease-out",
                visible
                  ? "translate-x-0 opacity-100"
                  : box.side === "right"
                    ? "translate-x-1 opacity-0"
                    : "-translate-x-1 opacity-0",
              )}
              onMouseEnter={showPopup}
              onMouseLeave={hidePopup}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tổng quan nhiệm vụ
              </p>
              <TaskPreviewContent task={task} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MonthYearPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(() => value.getFullYear());
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  function measure() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = 280;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - 12);
    return { top, left };
  }

  function openPicker() {
    setDraftYear(value.getFullYear());
    setBox(measure());
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    setBox(null);
  }

  function selectMonth(monthIndex: number) {
    onChange(startOfMonth(setMonthIndex(setYear(value, draftYear), monthIndex)));
    closePicker();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      closePicker();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    function onReposition() {
      setBox(measure());
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, value]);

  const selectedMonth = value.getMonth();
  const selectedYear = value.getFullYear();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? closePicker() : openPicker())}
        className={cn(
          "interactive-press inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-1 py-1 text-base font-semibold capitalize text-primary sm:min-w-48 sm:px-2 sm:text-lg",
          "transition-colors hover:bg-primary-muted/50",
          open && "bg-primary-muted/60",
        )}
      >
        {format(value, "MMMM yyyy", { locale: vi })}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-primary/70 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="dialog"
              aria-label="Chọn tháng và năm"
              style={{ top: box.top, left: box.left, width: 280 }}
              className="fixed z-[70] rounded-[5px] border border-slate-200/80 bg-white p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDraftYear((year) => year - 1)}
                  aria-label="Năm trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold text-primary">{draftYear}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDraftYear((year) => year + 1)}
                  aria-label="Năm sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_OPTIONS.map((option) => {
                  const selected =
                    option.index === selectedMonth && draftYear === selectedYear;
                  return (
                    <button
                      key={option.index}
                      type="button"
                      onClick={() => selectMonth(option.index)}
                      className={cn(
                        "interactive-press rounded-md px-2 py-2 text-center text-sm capitalize text-slate-700 transition-colors hover:bg-slate-50",
                        selected &&
                          "bg-primary text-white hover:bg-primary hover:text-white",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  className="interactive-press w-full rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-primary-muted/50"
                  onClick={() => {
                    onChange(startOfMonth(new Date()));
                    closePicker();
                  }}
                >
                  Tháng hiện tại
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function CalendarMonth({
  tasks,
  showAllFilter,
  scope,
}: {
  tasks: CalendarTask[];
  showAllFilter: boolean;
  scope: "mine" | "all";
}) {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthTasks = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return tasks.filter((task) => {
      const due = new Date(task.dueDate);
      return due >= start && due <= end;
    });
  }, [tasks, month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of monthTasks) {
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [monthTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <MonthYearPicker value={month} onChange={setMonth} />
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {showAllFilter && (
          <div className="flex rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={scope === "mine" ? "default" : "ghost"}
              onClick={() => router.push("/calendar?scope=mine")}
            >
              Của tôi
            </Button>
            <Button
              size="sm"
              variant={scope === "all" ? "default" : "ghost"}
              onClick={() => router.push("/calendar?scope=all")}
            >
              Tất cả
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="-mx-1 overflow-x-auto sm:mx-0">
          <div className="grid min-w-0 grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-slate-500 sm:gap-2 sm:text-xs">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
              <div key={d} className="py-1 sm:py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid min-w-0 grid-cols-7 gap-0.5 sm:mt-0 sm:gap-2">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-16 rounded-md border p-0.5 text-left transition-colors duration-200 sm:min-h-28 sm:rounded-lg sm:p-2",
                    inMonth
                      ? "border-border bg-white hover:border-sky-200 hover:bg-sky-50/80"
                      : "border-transparent bg-muted/50 text-slate-400 hover:bg-sky-50/40",
                    isSameDay(day, new Date()) && "ring-2 ring-primary/40",
                  )}
                >
                  <p className="text-[10px] font-semibold sm:text-xs">{format(day, "d")}</p>
                  <div className="mt-0.5 space-y-0.5 sm:mt-1 sm:space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <TaskPreviewChip key={task.id} task={task} />
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[10px] text-slate-500">
                        +{dayTasks.length - 3} khác
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hạn trong tháng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monthTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Không có hạn nào trong tháng này.</p>
          ) : (
            monthTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Hạn {format(new Date(task.dueDate), "dd/MM/yyyy")} • {task.assigneeName}
                  {task.clientName ? ` • ${task.clientName}` : ""}
                  {task.matterCode ? ` • ${task.matterCode}` : ""}
                </p>
                <Badge variant="warning" className="mt-2">
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
