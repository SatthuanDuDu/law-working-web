"use client";

import Link from "next/link";
import {
  addMonths,
  addWeeks,
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
  subWeeks,
} from "date-fns";
import { enUS, vi as viLocale } from "date-fns/locale";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type UIEvent, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Check, Circle, CircleDot, Ban, Clock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CalendarAddPlanDialog,
  type CalendarMatterOption,
  type CalendarWorkTypeOption,
} from "@/components/calendar/calendar-add-plan-dialog";
import { CalendarSideRail } from "@/components/calendar/calendar-side-rail";
import { CalendarWeekGrid } from "@/components/calendar/calendar-week-grid";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import { liquidPanelClass } from "@/lib/liquid-panel";
import {
  planStepStatusChipClass,
  StatusChip,
  taskPriorityChipClass,
  taskStatusChipClass,
} from "@/components/ui/status-chip";
import type { MatterPlanStepStatus, TaskPriority, TaskStatus } from "@prisma/client";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** Due within the next 2 hours (alert window on calendar chips). */
function isDueWithinTwoHours(dueIso: string, nowMs: number): boolean {
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return false;
  return due >= nowMs && due <= nowMs + TWO_HOURS_MS;
}

function useNowMs(intervalMs = 30_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

const CALENDAR_CHIP_BASE =
  "interactive-press flex w-full min-w-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-left text-[10px] font-medium sm:gap-1 sm:rounded-lg sm:px-1.5 sm:text-[11px]";
/** Week-row floor so a day cell can show the date header + at least 4 chips. */
const MONTH_WEEK_ROW_MIN = "10.75rem";
/** Task due — tonal charcoal (brand primary), not solid fill. */
const CALENDAR_CHIP_TASK =
  "border border-primary/15 bg-primary-muted text-primary hover:bg-primary-muted/80";
/** Plan step due — sky tonal (semantic schedule, not brand purple). */
const CALENDAR_CHIP_PLAN =
  "border border-sky-200/80 bg-sky-50 text-sky-950 hover:bg-sky-100/80 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60";
const CALENDAR_CHIP_URGENT =
  "border border-rose-300/80 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-500/50 dark:bg-rose-700 dark:hover:bg-rose-600";
const SEGMENT_TRACK =
  "inline-flex items-center rounded-full border-0 bg-surface-container p-1 shadow-inner";
const SEGMENT_BTN =
  "h-8 rounded-full px-3 text-xs font-medium sm:px-3.5 sm:text-[13px]";

/**
 * Mobile ghost-click guard: after opening/dismissing a chip sheet, ignore day-cell
 * "add plan" clicks for a short window (touch → click lands on the cell under the finger).
 */
let suppressDayAddUntil = 0;
const DAY_ADD_SUPPRESS_MS = 800;
const CHIP_SHEET_DISMISS_PX = 96;

function suppressDayAddClick(ms = DAY_ADD_SUPPRESS_MS) {
  suppressDayAddUntil = Date.now() + ms;
}

function isDayAddClickSuppressed() {
  return Date.now() < suppressDayAddUntil;
}

function stopDayCellBubble(event: {
  stopPropagation: () => void;
}) {
  event.stopPropagation();
}

function guardChipOpen(event: {
  stopPropagation: () => void;
  preventDefault: () => void;
}) {
  event.stopPropagation();
  event.preventDefault();
  suppressDayAddClick();
}

type ChipStatusKind = "todo" | "progress" | "done" | "blocked" | "cancelled";

function chipStatusFromTask(status: TaskStatus): ChipStatusKind {
  switch (status) {
    case "DONE":
      return "done";
    case "IN_PROGRESS":
      return "progress";
    case "CANCELLED":
      return "cancelled";
    default:
      return "todo";
  }
}

function chipStatusFromPlan(status: MatterPlanStepStatus): ChipStatusKind {
  switch (status) {
    case "DONE":
      return "done";
    case "IN_PROGRESS":
      return "progress";
    case "BLOCKED":
      return "blocked";
    default:
      return "todo";
  }
}

const CHIP_STATUS_MARK: Record<
  ChipStatusKind,
  { Icon: typeof Check; markClass: string; urgentMarkClass: string }
> = {
  todo: {
    Icon: Circle,
    markClass: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/35",
    urgentMarkClass: "bg-white/20 text-white ring-1 ring-inset ring-white/80",
  },
  progress: {
    Icon: CircleDot,
    markClass: "bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50",
    urgentMarkClass: "bg-sky-300 text-sky-950",
  },
  done: {
    Icon: Check,
    markClass:
      "bg-emerald-200 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-50",
    urgentMarkClass: "bg-emerald-400 text-emerald-950",
  },
  blocked: {
    Icon: Ban,
    markClass:
      "bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50",
    urgentMarkClass: "bg-amber-300 text-amber-950",
  },
  cancelled: {
    Icon: X,
    markClass: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
    urgentMarkClass: "bg-slate-300 text-slate-800",
  },
};

function CalendarChipLabel({
  title,
  timeLabel,
  urgent,
  statusKind,
  statusLabel,
  kindDotClass,
}: {
  title: string;
  timeLabel?: string;
  urgent: boolean;
  statusKind: ChipStatusKind;
  statusLabel: string;
  kindDotClass: string;
}) {
  const { Icon, markClass, urgentMarkClass } = CHIP_STATUS_MARK[statusKind];

  return (
    <>
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", kindDotClass)}
        aria-hidden
      />
      <span
        title={statusLabel}
        aria-label={statusLabel}
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px]",
          urgent ? urgentMarkClass : markClass,
        )}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      </span>
      {urgent ? (
        <Clock className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">
        {timeLabel ? (
          <>
            <span className="tabular-nums opacity-90">{timeLabel}</span>
            <span className="opacity-60"> · </span>
          </>
        ) : null}
        {title}
      </span>
    </>
  );
}
type CalendarPlanStep = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  priority: TaskPriority;
  dueAt: string;
  assigneeName: string | null;
  matterId: string;
  matterCode: string;
  matterTitle: string;
};

type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeName: string;
  matterId?: string | null;
  matterCode?: string | null;
  matterTitle?: string | null;
  clientName?: string | null;
  leadLawyerName?: string | null;
  collaboratorNames?: string[];
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

const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 20;
const TOOLTIP_PAD = 8;

type TooltipBox = {
  top: number;
  left: number;
  side: "left" | "right";
  maxHeight: number;
};

/** Keep fixed tooltip fully inside the viewport (clamp + scroll if needed). */
function placeTooltipInViewport(
  anchor: DOMRect,
  height: number,
): TooltipBox {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxHeight = Math.max(140, vh - TOOLTIP_PAD * 2);
  const usedHeight = Math.min(Math.max(height, 1), maxHeight);

  const spaceRight = vw - anchor.right - TOOLTIP_GAP;
  const spaceLeft = anchor.left - TOOLTIP_GAP;
  const side: "left" | "right" =
    spaceRight >= TOOLTIP_WIDTH || spaceRight >= spaceLeft ? "right" : "left";

  let left =
    side === "right"
      ? anchor.right + TOOLTIP_GAP
      : anchor.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
  left = Math.min(
    Math.max(TOOLTIP_PAD, left),
    Math.max(TOOLTIP_PAD, vw - TOOLTIP_WIDTH - TOOLTIP_PAD),
  );

  // Prefer align with anchor top; shift up when it would overflow the bottom.
  let top = anchor.top;
  if (top + usedHeight > vh - TOOLTIP_PAD) {
    top = vh - TOOLTIP_PAD - usedHeight;
  }
  // Prefer aligning near anchor bottom when more room above than below.
  const spaceBelow = vh - TOOLTIP_PAD - anchor.top;
  const spaceAbove = anchor.bottom - TOOLTIP_PAD;
  if (spaceBelow < usedHeight && spaceAbove > spaceBelow) {
    top = Math.max(TOOLTIP_PAD, anchor.bottom - usedHeight);
  }
  if (top + usedHeight > vh - TOOLTIP_PAD) {
    top = Math.max(TOOLTIP_PAD, vh - TOOLTIP_PAD - usedHeight);
  }
  if (top < TOOLTIP_PAD) top = TOOLTIP_PAD;

  return { top, left, side, maxHeight };
}

function useCalendarChipTooltip(
  rootRef: RefObject<HTMLDivElement | null>,
  coarse: boolean,
  estimatedHeight: number,
) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [box, setBox] = useState<TooltipBox | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  function measure(height = estimatedHeight) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return placeTooltipInViewport(rect, height);
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
    // Dismiss click-through: backdrop tap synthesizes a click on the day cell underneath.
    if (coarse) suppressDayAddClick();
    if (coarse) {
      setVisible(false);
      hideTimer.current = setTimeout(() => setOpen(false), 180);
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

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open || !coarse) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Inline close to avoid hidePopup identity in effect deps.
      clearTimers();
      if (coarse) suppressDayAddClick();
      setVisible(false);
      hideTimer.current = setTimeout(() => setOpen(false), 180);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, coarse]);

  // After paint, re-clamp using the real tooltip height so nothing sits under the fold.
  useLayoutEffect(() => {
    if (!open || coarse) return;

    function reclamp() {
      const el = tooltipRef.current;
      const anchor = rootRef.current?.getBoundingClientRect();
      if (!el || !anchor) return;
      const next = placeTooltipInViewport(anchor, el.scrollHeight || el.offsetHeight);
      setBox((prev) => {
        if (
          prev &&
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.maxHeight - next.maxHeight) < 1 &&
          prev.side === next.side
        ) {
          return prev;
        }
        return next;
      });
    }

    reclamp();
    window.addEventListener("resize", reclamp);
    window.addEventListener("scroll", reclamp, true);
    return () => {
      window.removeEventListener("resize", reclamp);
      window.removeEventListener("scroll", reclamp, true);
    };
  }, [open, coarse, rootRef]);

  return { open, visible, box, tooltipRef, showPopup, hidePopup };
}

function CalendarChipMobileSheet({
  visible,
  urgent,
  ariaLabel,
  dragLabel,
  closeLabel,
  onDismiss,
  children,
  footer,
}: {
  visible: boolean;
  urgent?: boolean;
  ariaLabel: string;
  dragLabel: string;
  closeLabel: string;
  onDismiss: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const sheetDragRef = useRef<{ pointerId: number; startY: number } | null>(
    null,
  );
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);

  const dismissY = Math.max(0, sheetDragY);
  const backdropOpacity =
    sheetDragging || dismissY > 0
      ? Math.max(0.15, 1 - dismissY / (CHIP_SHEET_DISMISS_PX * 1.6))
      : visible
        ? 1
        : 0;

  function endSheetDrag(deltaY: number) {
    setSheetDragging(false);
    sheetDragRef.current = null;
    if (deltaY >= CHIP_SHEET_DISMISS_PX) {
      onDismiss();
      setSheetDragY(0);
      return;
    }
    setSheetDragY(0);
  }

  function onSheetHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    setSheetDragging(true);
    setSheetDragY(0);
  }

  function onSheetHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setSheetDragY(Math.max(0, event.clientY - drag.startY));
  }

  function onSheetHandlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    endSheetDrag(event.clientY - drag.startY);
  }

  function onSheetHandlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    endSheetDrag(event.clientY - drag.startY);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 bg-slate-900/40 transition-opacity duration-200"
        style={{ opacity: backdropOpacity }}
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-label={ariaLabel}
        className={cn(
          "relative z-[1] max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-border bg-surface shadow-[var(--shadow-overlay)] transition-all duration-200",
          urgent && "border-l-[3px] border-l-red-500",
          visible && dismissY === 0 && !sheetDragging
            ? "translate-y-0 opacity-100"
            : !sheetDragging && dismissY === 0
              ? "translate-y-4 opacity-0"
              : "opacity-100",
        )}
        style={
          sheetDragging || dismissY > 0
            ? {
                transform: `translateY(${dismissY}px)`,
                transition: sheetDragging ? "none" : undefined,
              }
            : undefined
        }
      >
        <div
          role="button"
          aria-label={dragLabel}
          tabIndex={0}
          className="flex touch-none flex-col items-center pb-1 pt-2 cursor-grab active:cursor-grabbing"
          onPointerDown={onSheetHandlePointerDown}
          onPointerMove={onSheetHandlePointerMove}
          onPointerUp={onSheetHandlePointerUp}
          onPointerCancel={onSheetHandlePointerCancel}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDismiss();
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onDismiss();
            }
          }}
        >
          <span
            className="h-1 w-10 shrink-0 rounded-full bg-border"
            aria-hidden
          />
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

function PreviewKindLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
      {children}
    </span>
  );
}

function PreviewStatusChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <StatusChip
      label={label}
      className={cn("px-2 text-[11px] font-semibold", className)}
    />
  );
}

function PreviewPriorityChip({
  priority,
  label,
}: {
  priority: TaskPriority;
  label: string;
}) {
  return (
    <StatusChip
      label={label}
      className={cn(
        taskPriorityChipClass(priority),
        "px-2 text-[11px] font-semibold",
      )}
    />
  );
}

function PreviewDueBlock({
  dueIso,
  urgent,
  dueLabel,
  soonLabel,
}: {
  dueIso: string;
  urgent: boolean;
  dueLabel: string;
  soonLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2.5 py-2",
        urgent
          ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          : "bg-zinc-100 text-foreground dark:bg-zinc-800/50",
      )}
    >
      <Clock
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          urgent ? "text-red-600 dark:text-red-300" : "text-primary",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[11px] font-medium opacity-80">{dueLabel}</p>
        <p className="text-sm font-semibold tabular-nums tracking-tight">
          {format(new Date(dueIso), "HH:mm · dd/MM/yyyy")}
        </p>
        {urgent ? (
          <p className="mt-0.5 text-[11px] font-semibold">{soonLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewTooltipShell({
  side,
  visible,
  style,
  urgent,
  children,
  onMouseEnter,
  onMouseLeave,
  panelRef,
  role = "tooltip",
  "aria-label": ariaLabel,
}: {
  side?: "left" | "right";
  visible: boolean;
  style?: CSSProperties;
  urgent?: boolean;
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  role?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        "fixed z-[70] overflow-y-auto overscroll-contain rounded-md border border-border bg-surface shadow-[var(--shadow-overlay)] transition-all duration-200 ease-out [scrollbar-width:thin]",
        urgent && "border-l-[3px] border-l-red-500",
        visible
          ? "translate-x-0 opacity-100"
          : side === "left"
            ? "-translate-x-1 opacity-0"
            : "translate-x-1 opacity-0",
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

function TaskPreviewContent({
  task,
  urgent,
}: {
  task: CalendarTask;
  urgent: boolean;
}) {
  const t = useTranslations("calendar");
  const labels = useLabelMaps();
  const matterLine = task.matterTitle
    ? `${task.matterCode ? `${task.matterCode} · ` : ""}${task.matterTitle}`
    : null;

  return (
    <div className="space-y-3 p-3.5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <PreviewKindLabel>{t("kindTask")}</PreviewKindLabel>
          {urgent ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {t("dueSoon")}
            </span>
          ) : null}
        </div>
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {task.title}
        </p>
        {task.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {task.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <PreviewStatusChip
            label={labels.taskStatus[task.status]}
            className={taskStatusChipClass(task.status)}
          />
          <PreviewPriorityChip
            priority={task.priority}
            label={labels.taskPriority[task.priority]}
          />
        </div>
      </div>

      <PreviewDueBlock
        dueIso={task.dueDate}
        urgent={urgent}
        dueLabel={t("taskSchedule")}
        soonLabel={t("dueSoon")}
      />

      <div className="space-y-1.5 border-t border-border/70 pt-2.5 text-xs">
        <div className="flex gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">{t("taskClient")}</span>
          <span className="min-w-0 font-medium text-foreground">
            {task.clientName || "—"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">{t("taskMatter")}</span>
          <span className="min-w-0 font-medium text-foreground">
            {matterLine || "—"}
          </span>
        </div>
        {(task.leadLawyerName || (task.collaboratorNames?.length ?? 0) > 0) && (
          <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
            {task.leadLawyerName ? (
              <p>
                <span className="font-medium text-foreground/80">{t("leadLawyer")}: </span>
                {task.leadLawyerName}
              </p>
            ) : null}
            {task.collaboratorNames && task.collaboratorNames.length > 0 ? (
              <p>
                <span className="font-medium text-foreground/80">{t("collaborators")}: </span>
                {task.collaboratorNames.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanPreviewContent({
  step,
  urgent,
}: {
  step: CalendarPlanStep;
  urgent: boolean;
}) {
  const t = useTranslations("calendar");
  const labels = useLabelMaps();

  return (
    <div className="space-y-3 p-3.5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <PreviewKindLabel>{t("kindPlan")}</PreviewKindLabel>
          {urgent ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {t("dueSoon")}
            </span>
          ) : null}
        </div>
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {step.title}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <PreviewStatusChip
            label={labels.planStepStatus[step.status]}
            className={planStepStatusChipClass(step.status)}
          />
          <PreviewPriorityChip
            priority={step.priority}
            label={labels.taskPriority[step.priority]}
          />
        </div>
      </div>

      <PreviewDueBlock
        dueIso={step.dueAt}
        urgent={urgent}
        dueLabel={t("taskSchedule")}
        soonLabel={t("dueSoon")}
      />

      <div className="flex gap-2 border-t border-border/70 pt-2.5 text-xs">
        <span className="w-20 shrink-0 text-muted-foreground">{t("taskMatter")}</span>
        <span className="min-w-0 font-medium text-foreground">
          {step.matterCode ? `${step.matterCode} · ` : ""}
          {step.matterTitle}
        </span>
      </div>
      <div className="flex gap-2 text-xs">
        <span className="w-20 shrink-0 text-muted-foreground">{t("assignee")}</span>
        <span className="min-w-0 font-medium text-foreground">
          {step.assigneeName ?? "—"}
        </span>
      </div>
    </div>
  );
}

function TaskPreviewChip({ task }: { task: CalendarTask }) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();
  const rootRef = useRef<HTMLDivElement>(null);
  const coarse = useIsCoarsePointer();
  const nowMs = useNowMs();
  const urgent = isDueWithinTwoHours(task.dueDate, nowMs);
  const { open, visible, box, tooltipRef, showPopup, hidePopup } =
    useCalendarChipTooltip(rootRef, coarse, 280);

  const href = task.matterId ? `/matters/${task.matterId}` : null;
  const chipClass = cn(
    CALENDAR_CHIP_BASE,
    urgent ? CALENDAR_CHIP_URGENT : CALENDAR_CHIP_TASK,
  );
  const statusKind = chipStatusFromTask(task.status);
  const label = (
    <CalendarChipLabel
      title={task.title}
      timeLabel={format(new Date(task.dueDate), "HH:mm")}
      urgent={urgent}
      statusKind={statusKind}
      statusLabel={labels.taskStatus[task.status]}
      kindDotClass={urgent ? "bg-white" : "bg-primary"}
    />
  );

  return (
    <>
      <div
        ref={rootRef}
        data-calendar-chip
        className="relative"
        onPointerDown={stopDayCellBubble}
        onClick={stopDayCellBubble}
        onMouseEnter={coarse ? undefined : showPopup}
        onMouseLeave={coarse ? undefined : hidePopup}
        onFocus={coarse ? undefined : showPopup}
        onBlur={coarse ? undefined : hidePopup}
      >
        {coarse ? (
          <button
            type="button"
            className={chipClass}
            onClick={(e) => {
              guardChipOpen(e);
              showPopup();
            }}
          >
            {label}
          </button>
        ) : href ? (
          <Link href={href} className={chipClass}>
            {label}
          </Link>
        ) : (
          <div className={chipClass}>{label}</div>
        )}
      </div>
      {open && coarse
        ? createPortal(
            <CalendarChipMobileSheet
              visible={visible}
              urgent={urgent}
              ariaLabel={t("taskOverview")}
              dragLabel={t("dragSheet")}
              closeLabel={tCommon("close")}
              onDismiss={hidePopup}
              footer={
                href ? (
                  <div className="border-t border-border p-3.5 pt-3">
                    <Link
                      href={href}
                      className="interactive-press inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                      onClick={hidePopup}
                    >
                      {t("viewMatter")}
                    </Link>
                  </div>
                ) : null
              }
            >
              <TaskPreviewContent task={task} urgent={urgent} />
            </CalendarChipMobileSheet>,
            document.body,
          )
        : null}
      {open && box && !coarse
        ? createPortal(
            <PreviewTooltipShell
              panelRef={tooltipRef}
              side={box.side}
              visible={visible}
              urgent={urgent}
              style={{
                top: box.top,
                left: box.left,
                width: TOOLTIP_WIDTH,
                maxHeight: box.maxHeight,
              }}
              onMouseEnter={showPopup}
              onMouseLeave={hidePopup}
              aria-label={t("taskOverview")}
            >
              <TaskPreviewContent task={task} urgent={urgent} />
            </PreviewTooltipShell>,
            document.body,
          )
        : null}
    </>
  );
}

function PlanPreviewChip({ step }: { step: CalendarPlanStep }) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();
  const rootRef = useRef<HTMLDivElement>(null);
  const coarse = useIsCoarsePointer();
  const nowMs = useNowMs();
  const urgent = isDueWithinTwoHours(step.dueAt, nowMs);
  const { open, visible, box, tooltipRef, showPopup, hidePopup } =
    useCalendarChipTooltip(rootRef, coarse, 240);
  const href = `/matters/${step.matterId}/plan`;

  const chipClass = cn(
    CALENDAR_CHIP_BASE,
    urgent ? CALENDAR_CHIP_URGENT : CALENDAR_CHIP_PLAN,
  );
  const statusKind = chipStatusFromPlan(step.status);
  const label = (
    <CalendarChipLabel
      title={step.title}
      timeLabel={format(new Date(step.dueAt), "HH:mm")}
      urgent={urgent}
      statusKind={statusKind}
      statusLabel={labels.planStepStatus[step.status]}
      kindDotClass={urgent ? "bg-white" : "bg-sky-600 dark:bg-sky-400"}
    />
  );

  return (
    <>
      <div
        ref={rootRef}
        data-calendar-chip
        className="relative"
        onPointerDown={stopDayCellBubble}
        onClick={stopDayCellBubble}
        onMouseEnter={coarse ? undefined : showPopup}
        onMouseLeave={coarse ? undefined : hidePopup}
        onFocus={coarse ? undefined : showPopup}
        onBlur={coarse ? undefined : hidePopup}
      >
        {coarse ? (
          <button
            type="button"
            className={chipClass}
            onClick={(e) => {
              guardChipOpen(e);
              showPopup();
            }}
          >
            {label}
          </button>
        ) : (
          <Link href={href} className={chipClass}>
            {label}
          </Link>
        )}
      </div>
      {open && coarse
        ? createPortal(
            <CalendarChipMobileSheet
              visible={visible}
              urgent={urgent}
              ariaLabel={t("planOverview")}
              dragLabel={t("dragSheet")}
              closeLabel={tCommon("close")}
              onDismiss={hidePopup}
              footer={
                <div className="border-t border-border p-3.5 pt-3">
                  <Link
                    href={href}
                    className="interactive-press inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                    onClick={hidePopup}
                  >
                    {t("viewPlan")}
                  </Link>
                </div>
              }
            >
              <PlanPreviewContent step={step} urgent={urgent} />
            </CalendarChipMobileSheet>,
            document.body,
          )
        : null}
      {open && box && !coarse
        ? createPortal(
            <PreviewTooltipShell
              panelRef={tooltipRef}
              side={box.side}
              visible={visible}
              urgent={urgent}
              style={{
                top: box.top,
                left: box.left,
                width: TOOLTIP_WIDTH,
                maxHeight: box.maxHeight,
              }}
              onMouseEnter={showPopup}
              onMouseLeave={hidePopup}
              aria-label={t("planOverview")}
            >
              <PlanPreviewContent step={step} urgent={urgent} />
            </PreviewTooltipShell>,
            document.body,
          )
        : null}
    </>
  );
}

function DayCellScrollList({ children }: { children: ReactNode }) {
  const t = useTranslations("calendar");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const updateIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanUp(false);
      setCanDown(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 1;
    setCanUp(overflow && scrollTop > 2);
    setCanDown(overflow && scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    updateIndicators();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateIndicators());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateIndicators, children]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    event.stopPropagation();
    updateIndicators();
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) return;
    // Keep wheel scrolling inside the day cell when content overflows.
    event.stopPropagation();
  }

  return (
    <div className="relative mt-0.5 min-h-0 flex-1 sm:mt-1">
      {canUp ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex justify-center bg-gradient-to-b from-surface via-surface/90 to-transparent pb-2 pt-0.5"
          aria-hidden
        >
          <ChevronUp className="h-3 w-3 text-primary animate-bounce" />
        </div>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={onWheel}
        className="h-full min-h-0 space-y-0.5 overflow-y-auto overscroll-contain sm:space-y-1 [scrollbar-width:thin]"
      >
        {children}
      </div>
      {canDown ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col items-center bg-gradient-to-t from-surface via-surface/90 to-transparent pb-0.5 pt-2"
          aria-hidden
        >
          <ChevronDown className="h-3 w-3 text-primary animate-bounce" />
          <span className="sr-only">{t("scrollMore")}</span>
        </div>
      ) : null}
    </div>
  );
}

function MonthYearPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (next: Date) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const dateLocale = locale === "en" ? enUS : viLocale;
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        index,
        label: format(new Date(2020, index, 1), "MMMM", { locale: dateLocale }),
      })),
    [dateLocale],
  );
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
          "transition-colors hover:bg-primary-muted-hover",
          open && "bg-primary-muted",
        )}
      >
        {format(value, "MMMM yyyy", { locale: dateLocale })}
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
              aria-label={t("pickMonthYear")}
              style={{ top: box.top, left: box.left, width: 280 }}
              className="fixed z-[70] rounded-md border border-border bg-surface p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDraftYear((year) => year - 1)}
                  aria-label={t("prevYear")}
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
                  aria-label={t("nextYear")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {monthOptions.map((option) => {
                  const selected =
                    option.index === selectedMonth && draftYear === selectedYear;
                  return (
                    <button
                      key={option.index}
                      type="button"
                      onClick={() => selectMonth(option.index)}
                      className={cn(
                        "interactive-press rounded-md px-2 py-2 text-center text-sm capitalize text-foreground transition-colors hover:bg-muted",
                        selected &&
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border pt-2">
                <button
                  type="button"
                  className="interactive-press w-full rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-primary-muted-hover"
                  onClick={() => {
                    onChange(startOfMonth(new Date()));
                    closePicker();
                  }}
                >
                  {t("currentMonth")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}


function isUrgentDeadline(
  dueIso: string,
  priority: TaskPriority,
  nowMs: number,
) {
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due) || due < nowMs) return false;
  const withinWeek = due <= nowMs + 7 * 24 * 60 * 60 * 1000;
  if (!withinWeek) return false;
  if (priority === "URGENT" || priority === "HIGH") return true;
  return due <= nowMs + 2 * 24 * 60 * 60 * 1000;
}

export function CalendarMonth({
  tasks,
  planSteps = [],
  matters = [],
  workTypes = [],
  assigneeOptions = [],
  showAllFilter,
  scope,
}: {
  tasks: CalendarTask[];
  planSteps?: CalendarPlanStep[];
  matters?: CalendarMatterOption[];
  workTypes?: CalendarWorkTypeOption[];
  assigneeOptions?: { id: string; name: string }[];
  showAllFilter: boolean;
  scope: "mine" | "all";
}) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const tPages = useTranslations("pages.calendar");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [addPlanDay, setAddPlanDay] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());
  const [showTasks, setShowTasks] = useState(true);
  const [showPlans, setShowPlans] = useState(true);
  const nowMs = useNowMs(60_000);

  const weekdayLabels = [
    t("weekdayMon"),
    t("weekdayTue"),
    t("weekdayWed"),
    t("weekdayThu"),
    t("weekdayFri"),
    t("weekdaySat"),
    t("weekdaySun"),
  ];
  const weekdayShort = weekdayLabels;

  const weekEnd = useMemo(
    () => endOfWeek(weekAnchor, { weekStartsOn: 1 }),
    [weekAnchor],
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);
  const monthWeekCount = Math.max(4, Math.ceil(monthDays.length / 7));

  const filteredTasks = useMemo(
    () => (showTasks ? tasks : []),
    [showTasks, tasks],
  );
  const filteredPlans = useMemo(
    () => (showPlans ? planSteps : []),
    [showPlans, planSteps],
  );

  const gridStart = useMemo(
    () =>
      viewMode === "week"
        ? weekAnchor
        : startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    [viewMode, weekAnchor, month],
  );
  const gridEnd = useMemo(
    () =>
      viewMode === "week"
        ? weekEnd
        : endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    [viewMode, weekEnd, month],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of filteredTasks) {
      const due = new Date(task.dueDate);
      if (due < gridStart || due > gridEnd) continue;
      const key = format(due, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [filteredTasks, gridStart, gridEnd]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, CalendarPlanStep[]>();
    for (const step of filteredPlans) {
      const due = new Date(step.dueAt);
      if (due < gridStart || due > gridEnd) continue;
      const key = format(due, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(step);
      map.set(key, list);
    }
    return map;
  }, [filteredPlans, gridStart, gridEnd]);

  const urgentCount = useMemo(() => {
    let n = 0;
    for (const task of tasks) {
      if (isUrgentDeadline(task.dueDate, task.priority, nowMs)) n += 1;
    }
    for (const step of planSteps) {
      if (isUrgentDeadline(step.dueAt, step.priority, nowMs)) n += 1;
    }
    return n;
  }, [tasks, planSteps, nowMs]);

  const urgentRailItems = useMemo(() => {
    type Row = {
      id: string;
      kind: "task" | "plan";
      title: string;
      whenLabel: string;
      matterLabel: string;
      href: string;
      sortAt: number;
    };
    const rows: Row[] = [];
    for (const task of tasks) {
      if (!isUrgentDeadline(task.dueDate, task.priority, nowMs)) continue;
      const due = new Date(task.dueDate);
      rows.push({
        id: `task-${task.id}`,
        kind: "task",
        title: task.title,
        whenLabel: format(due, "dd/MM/yyyy HH:mm"),
        matterLabel: task.matterTitle
          ? `${task.matterCode ?? ""} · ${task.matterTitle}`.replace(/^ · /, "")
          : (task.clientName ?? "—"),
        href: task.matterId ? `/matters/${task.matterId}` : "/tasks",
        sortAt: due.getTime(),
      });
    }
    for (const step of planSteps) {
      if (!isUrgentDeadline(step.dueAt, step.priority, nowMs)) continue;
      const due = new Date(step.dueAt);
      rows.push({
        id: `plan-${step.id}`,
        kind: "plan",
        title: step.title,
        whenLabel: format(due, "dd/MM/yyyy HH:mm"),
        matterLabel: `${step.matterCode} · ${step.matterTitle}`,
        href: `/matters/${step.matterId}/plan`,
        sortAt: due.getTime(),
      });
    }
    return rows.sort((a, b) => a.sortAt - b.sortAt);
  }, [tasks, planSteps, nowMs]);

  const selectedFocus = useMemo(() => {
    if (!selectedDay) return null;
    const key = format(selectedDay, "yyyy-MM-dd");
    const dayTasks = tasksByDay.get(key) ?? [];
    const dayPlans = plansByDay.get(key) ?? [];
    const events = [
      ...dayPlans.map((step) => ({
        kind: "plan" as const,
        sortAt: new Date(step.dueAt).getTime(),
        title: step.title,
        time: format(new Date(step.dueAt), "HH:mm"),
        meta: `${step.matterCode} · ${step.matterTitle}`,
        href: `/matters/${step.matterId}/plan`,
        assignee: step.assigneeName,
      })),
      ...dayTasks.map((task) => ({
        kind: "task" as const,
        sortAt: new Date(task.dueDate).getTime(),
        title: task.title,
        time: format(new Date(task.dueDate), "HH:mm"),
        meta: task.matterTitle
          ? `${task.matterCode ?? ""} · ${task.matterTitle}`.replace(/^ · /, "")
          : (task.clientName ?? task.assigneeName),
        href: task.matterId ? `/matters/${task.matterId}` : "/tasks",
        assignee: task.assigneeName,
      })),
    ].sort((a, b) => a.sortAt - b.sortAt);
    return { key, events };
  }, [selectedDay, tasksByDay, plansByDay]);

  const weekRangeLabel = t("weekRange", {
    start: format(weekAnchor, "dd/MM"),
    end: format(weekEnd, "dd/MM/yyyy"),
  });

  function jumpToWeek(target: Date) {
    setWeekAnchor(startOfWeek(target, { weekStartsOn: 1 }));
  }

  function goToToday() {
    const now = new Date();
    jumpToWeek(now);
    setMonth(startOfMonth(now));
    setSelectedDay(now);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden overscroll-none sm:gap-4">
      <CalendarAddPlanDialog
        open={!!addPlanDay}
        day={addPlanDay}
        matters={matters}
        workTypes={workTypes}
        assigneeOptions={assigneeOptions}
        onClose={() => setAddPlanDay(null)}
      />

      {/* Page hero — Nexus calendar chrome */}
      <div className="shrink-0 -mx-3 space-y-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-block h-6 w-1.5 shrink-0 rounded-full bg-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {tPages("title")}
              </h1>
              {urgentCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-600" />
                  {t("urgentBadge", { count: urgentCount })}
                </span>
              ) : null}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {tPages("description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={SEGMENT_TRACK} role="group" aria-label={t("monthGrid")}>
              <Button
                size="sm"
                className={SEGMENT_BTN}
                variant={viewMode === "week" ? "default" : "ghost"}
                onClick={() => setViewMode("week")}
              >
                {t("week")}
              </Button>
              <Button
                size="sm"
                className={SEGMENT_BTN}
                variant={viewMode === "month" ? "default" : "ghost"}
                onClick={() => setViewMode("month")}
              >
                {t("month")}
              </Button>
            </div>
            {showAllFilter ? (
              <div className={SEGMENT_TRACK} role="group" aria-label={t("scopeMine")}>
                <Button
                  size="sm"
                  className={SEGMENT_BTN}
                  variant={scope === "mine" ? "default" : "ghost"}
                  onClick={() => router.push("/calendar?scope=mine")}
                >
                  {t("scopeMine")}
                </Button>
                <Button
                  size="sm"
                  className={SEGMENT_BTN}
                  variant={scope === "all" ? "default" : "ghost"}
                  onClick={() => router.push("/calendar?scope=all")}
                >
                  {t("scopeAll")}
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full sm:h-9"
              onClick={() => setAddPlanDay(selectedDay ?? new Date())}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("addPlan")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {viewMode === "week" ? (
              <>
                <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-container p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={t("prevWeek")}
                    onClick={() => jumpToWeek(subWeeks(weekAnchor, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-sm font-semibold tabular-nums sm:text-base">
                    {weekRangeLabel}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={t("nextWeek")}
                    onClick={() => jumpToWeek(addWeeks(weekAnchor, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-container p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={t("prevMonth")}
                    onClick={() => setMonth(subMonths(month, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="inline-flex px-1">
                    <MonthYearPicker value={month} onChange={setMonth} />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={t("nextMonth")}
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={goToToday}
            >
              {t("today")}
            </Button>
          </div>
          <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {t("legendTask")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-600" />
              {t("legendPlan")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              {t("legendUrgent")}
            </span>
          </div>
        </div>
      </div>

      {viewMode === "week" ? (
        <section
          aria-label={t("weekAgenda")}
          className={cn(
            liquidPanelClass,
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl",
          )}
        >
          <CalendarWeekGrid
            weekAnchor={weekAnchor}
            weekdayLabels={weekdayLabels}
            tasksByDay={tasksByDay}
            plansByDay={plansByDay}
            todayLabel={t("todayBadge")}
            allDayLabel={t("allDay")}
            timezoneLabel={t("timezone")}
          />
        </section>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
          <div className="shrink-0 overflow-y-auto overscroll-contain lg:max-h-full">
            <CalendarSideRail
              month={month}
              onMonthChange={setMonth}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              showTasks={showTasks}
              showPlans={showPlans}
              onToggleTasks={() => setShowTasks((v) => !v)}
              onTogglePlans={() => setShowPlans((v) => !v)}
              urgentItems={urgentRailItems}
              weekdayShort={weekdayShort}
              labels={{
                miniMonth: t("miniMonth", {
                  month: format(month, "M"),
                  year: format(month, "yyyy"),
                }),
                categories: t("categories"),
                selectAll: t("selectAll"),
                kindTask: t("kindTask"),
                kindPlan: t("kindPlan"),
                urgentTitle: t("urgentRailTitle"),
                viewDetail: t("viewDetail"),
              }}
            />
          </div>

          <section
            aria-label={t("monthGrid")}
            className={cn(
              liquidPanelClass,
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl",
            )}
          >
            <div className="grid min-w-0 shrink-0 grid-cols-7 gap-px bg-surface-container text-center text-[10px] font-semibold sm:text-xs">
              {weekdayLabels.map((d, idx) => (
                <div
                  key={d}
                  className={cn(
                    "py-2.5",
                    idx === 5 && "bg-primary/5 font-bold text-primary",
                    idx === 6 &&
                      "bg-rose-500/5 font-bold text-rose-700 dark:text-rose-400",
                    idx < 5 && "text-muted-foreground",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <div
                data-calendar-month-grid
                className="grid min-h-full min-w-0 grid-cols-7 gap-px bg-border/60"
                style={{
                  gridTemplateRows: `repeat(${monthWeekCount}, minmax(${MONTH_WEEK_ROW_MIN}, 1fr))`,
                }}
              >
                {monthDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayTasks = tasksByDay.get(key) ?? [];
                  const dayPlans = plansByDay.get(key) ?? [];
                  const inMonth = isSameMonth(day, month);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay
                    ? isSameDay(day, selectedDay)
                    : false;
                  const dow = day.getDay();
                  const isWeekend = dow === 0 || dow === 6;

                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (isDayAddClickSuppressed()) return;
                        if (
                          (e.target as HTMLElement | null)?.closest?.(
                            "[data-calendar-chip]",
                          )
                        ) {
                          return;
                        }
                        setSelectedDay(day);
                        // second click on empty area opens add
                        if (isSelected && dayTasks.length + dayPlans.length === 0) {
                          setAddPlanDay(day);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isDayAddClickSuppressed()) return;
                        setAddPlanDay(day);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDay(day);
                        }
                      }}
                      className={cn(
                        "interactive-press flex h-full min-h-0 cursor-pointer flex-col overflow-hidden p-1 text-left transition-colors duration-200 sm:p-2",
                        inMonth
                          ? isWeekend
                            ? "bg-surface-container-low/50 hover:bg-primary-muted/40"
                            : "bg-surface hover:bg-primary-muted/45"
                          : "bg-muted/35 text-muted-foreground hover:bg-muted/50",
                        isToday && !isSelected && "ring-2 ring-inset ring-primary/35",
                        isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
                      )}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1">
                          <p
                            className={cn(
                              "text-[10px] font-semibold sm:text-xs",
                              isToday &&
                                "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm sm:h-7 sm:w-7",
                              !isToday &&
                                inMonth &&
                                dow === 0 &&
                                "text-rose-700 dark:text-rose-400",
                              !isToday && inMonth && dow === 6 && "text-primary",
                            )}
                          >
                            {format(day, "d")}
                          </p>
                          {isToday ? (
                            <span className="hidden text-[9px] font-bold uppercase tracking-wide text-primary sm:inline">
                              {t("todayBadge")}
                            </span>
                          ) : null}
                          {isSelected && !isToday ? (
                            <span className="hidden rounded bg-primary px-1 py-px text-[8px] font-bold uppercase text-primary-foreground sm:inline">
                              {t("selectedBadge")}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="interactive-press inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-muted hover:text-primary"
                          aria-label={t("addPlan")}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDayAddClickSuppressed()) return;
                            setAddPlanDay(day);
                          }}
                        >
                          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                        </button>
                      </div>
                      {dayPlans.length > 0 || dayTasks.length > 0 ? (
                        <div className="flex min-h-0 flex-1 flex-col">
                          <DayCellScrollList>
                            {dayPlans.map((step) => (
                              <PlanPreviewChip key={step.id} step={step} />
                            ))}
                            {dayTasks.map((task) => (
                              <TaskPreviewChip key={task.id} task={task} />
                            ))}
                          </DayCellScrollList>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Day focus flyout — real events only */}
      {viewMode === "month" && selectedFocus && selectedFocus.events[0] ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-30 hidden max-w-sm md:block">
          <div className="pointer-events-auto rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-overlay)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {t("dayFocus", { date: format(selectedDay!, "dd/MM/yyyy") })}
              </p>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-surface-container hover:text-foreground"
                aria-label={t("today")}
                onClick={() => setSelectedDay(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {selectedFocus.events.slice(0, 2).map((ev) => (
                <div key={`${ev.kind}-${ev.title}-${ev.time}`} className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-foreground">
                    {ev.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ev.meta}
                    {ev.assignee ? ` · ${ev.assignee}` : ""}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        ev.kind === "plan"
                          ? "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
                          : "bg-primary-muted text-primary",
                      )}
                    >
                      {ev.time}
                    </span>
                    <Link
                      href={ev.href}
                      className="ml-auto text-[11px] font-medium text-primary hover:underline"
                    >
                      {t("viewDetail")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
