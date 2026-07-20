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
import { enUS, vi as viLocale } from "date-fns/locale";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type UIEvent, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Check, Circle, CircleDot, Ban, Clock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarAddPlanDialog,
  type CalendarMatterOption,
  type CalendarWorkTypeOption,
} from "@/components/calendar/calendar-add-plan-dialog";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import type { MatterPlanStepStatus, TaskPriority, TaskStatus } from "@prisma/client";

/** Soft Material tonal chips by task priority (lists / tooltips) */
const TASK_PRIORITY_CHIP_CLASS: Record<TaskPriority, string> = {
  LOW: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200",
  MEDIUM: "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200",
  HIGH: "bg-orange-500 text-white dark:bg-orange-600",
  URGENT: "bg-red-600 text-white dark:bg-red-700",
};

const PLAN_STATUS_BADGE: Record<
  MatterPlanStepStatus,
  { Icon: typeof Check; className: string }
> = {
  NOT_STARTED: {
    Icon: Circle,
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  },
  IN_PROGRESS: {
    Icon: CircleDot,
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  DONE: {
    Icon: Check,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  BLOCKED: {
    Icon: Ban,
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

const TASK_STATUS_BADGE: Record<
  TaskStatus,
  { Icon: typeof Check; className: string }
> = {
  TODO: {
    Icon: Circle,
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  },
  IN_PROGRESS: {
    Icon: CircleDot,
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  DONE: {
    Icon: Check,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  CANCELLED: {
    Icon: X,
    className: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
  },
};

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
  "interactive-press flex w-full min-w-0 items-center gap-0.5 rounded px-1 py-0.5 text-left text-[10px] font-medium text-white sm:gap-1 sm:px-1.5 sm:text-[11px]";
const CALENDAR_CHIP_NORMAL = "bg-primary hover:bg-primary-hover";
const CALENDAR_CHIP_URGENT =
  "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600";

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
  { Icon: typeof Check; markClass: string }
> = {
  todo: {
    Icon: Circle,
    markClass: "bg-white/20 text-white ring-1 ring-inset ring-white/80",
  },
  progress: {
    Icon: CircleDot,
    markClass: "bg-sky-300 text-sky-950",
  },
  done: {
    Icon: Check,
    markClass: "bg-emerald-400 text-emerald-950",
  },
  blocked: {
    Icon: Ban,
    markClass: "bg-amber-300 text-amber-950",
  },
  cancelled: {
    Icon: X,
    markClass: "bg-slate-300 text-slate-800",
  },
};

function CalendarChipLabel({
  title,
  urgent,
  statusKind,
  statusLabel,
}: {
  title: string;
  urgent: boolean;
  statusKind: ChipStatusKind;
  statusLabel: string;
}) {
  const { Icon, markClass } = CHIP_STATUS_MARK[statusKind];

  return (
    <>
      <span
        title={statusLabel}
        aria-label={statusLabel}
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px]",
          markClass,
        )}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      </span>
      {urgent ? (
        <Clock className="h-3 w-3 shrink-0 text-white" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate text-white">{title}</span>
    </>
  );
}

type CalendarPlanStep = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  priority: TaskPriority;
  dueAt: string;
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
      clearTimers();
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

function PreviewKindLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
      {children}
    </span>
  );
}

function PreviewStatusChip({
  Icon,
  label,
  className,
}: {
  Icon: typeof Check;
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
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
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TASK_PRIORITY_CHIP_CLASS[priority],
      )}
    >
      {label}
    </span>
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
  const status = TASK_STATUS_BADGE[task.status];
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
            Icon={status.Icon}
            label={labels.taskStatus[task.status]}
            className={status.className}
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
  const status = PLAN_STATUS_BADGE[step.status];

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
            Icon={status.Icon}
            label={labels.planStepStatus[step.status]}
            className={status.className}
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
    urgent ? CALENDAR_CHIP_URGENT : CALENDAR_CHIP_NORMAL,
  );
  const statusKind = chipStatusFromTask(task.status);
  const label = (
    <CalendarChipLabel
      title={task.title}
      urgent={urgent}
      statusKind={statusKind}
      statusLabel={labels.taskStatus[task.status]}
    />
  );

  return (
    <>
      <div
        ref={rootRef}
        className="relative"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={coarse ? undefined : showPopup}
        onMouseLeave={coarse ? undefined : hidePopup}
        onFocus={coarse ? undefined : showPopup}
        onBlur={coarse ? undefined : hidePopup}
      >
        {coarse ? (
          <button type="button" className={chipClass} onClick={showPopup}>
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
            <div className="fixed inset-0 z-[70] flex items-end justify-center">
              <button
                type="button"
                aria-label={tCommon("close")}
                className={cn(
                  "absolute inset-0 bg-slate-900/40 transition-opacity duration-200",
                  visible ? "opacity-100" : "opacity-0",
                )}
                onClick={hidePopup}
              />
              <div
                role="dialog"
                aria-label={t("taskOverview")}
                className={cn(
                  "relative z-[1] max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-border bg-surface shadow-[var(--shadow-overlay)] transition-all duration-200",
                  urgent && "border-l-[3px] border-l-red-500",
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                <TaskPreviewContent task={task} urgent={urgent} />
                {href ? (
                  <div className="border-t border-border p-3.5 pt-3">
                    <Link
                      href={href}
                      className="interactive-press inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-white"
                      onClick={hidePopup}
                    >
                      {t("viewMatter")}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>,
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
    urgent ? CALENDAR_CHIP_URGENT : CALENDAR_CHIP_NORMAL,
  );
  const statusKind = chipStatusFromPlan(step.status);
  const label = (
    <CalendarChipLabel
      title={step.title}
      urgent={urgent}
      statusKind={statusKind}
      statusLabel={labels.planStepStatus[step.status]}
    />
  );

  return (
    <>
      <div
        ref={rootRef}
        className="relative"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={coarse ? undefined : showPopup}
        onMouseLeave={coarse ? undefined : hidePopup}
        onFocus={coarse ? undefined : showPopup}
        onBlur={coarse ? undefined : hidePopup}
      >
        {coarse ? (
          <button type="button" className={chipClass} onClick={showPopup}>
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
            <div className="fixed inset-0 z-[70] flex items-end justify-center">
              <button
                type="button"
                aria-label={tCommon("close")}
                className={cn(
                  "absolute inset-0 bg-slate-900/40 transition-opacity duration-200",
                  visible ? "opacity-100" : "opacity-0",
                )}
                onClick={hidePopup}
              />
              <div
                role="dialog"
                aria-label={t("planOverview")}
                className={cn(
                  "relative z-[1] max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-border bg-surface shadow-[var(--shadow-overlay)] transition-all duration-200",
                  urgent && "border-l-[3px] border-l-red-500",
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                <PlanPreviewContent step={step} urgent={urgent} />
                <div className="border-t border-border p-3.5 pt-3">
                  <Link
                    href={href}
                    className="interactive-press inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                    onClick={hidePopup}
                  >
                    {t("viewPlan")}
                  </Link>
                </div>
              </div>
            </div>,
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
        className="max-h-[3.25rem] space-y-0.5 overflow-y-auto overscroll-contain sm:max-h-[6.5rem] sm:space-y-1 [scrollbar-width:thin]"
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
          "transition-colors hover:bg-primary-muted/50",
          open && "bg-primary-muted/60",
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
              className="fixed z-[70] rounded-[5px] border border-border bg-surface p-3"
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
                          "bg-primary text-white hover:bg-primary hover:text-white",
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
                  className="interactive-press w-full rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-primary-muted/50"
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

export function CalendarMonth({
  tasks,
  planSteps = [],
  matters = [],
  workTypes = [],
  showAllFilter,
  scope,
}: {
  tasks: CalendarTask[];
  planSteps?: CalendarPlanStep[];
  matters?: CalendarMatterOption[];
  workTypes?: CalendarWorkTypeOption[];
  showAllFilter: boolean;
  scope: "mine" | "all";
}) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const labels = useLabelMaps();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [addPlanDay, setAddPlanDay] = useState<Date | null>(null);

  const weekdayLabels = [
    t("weekdayMon"),
    t("weekdayTue"),
    t("weekdayWed"),
    t("weekdayThu"),
    t("weekdayFri"),
    t("weekdaySat"),
    t("weekdaySun"),
  ];

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

  const plansByDay = useMemo(() => {
    const map = new Map<string, CalendarPlanStep[]>();
    for (const step of planSteps) {
      const key = format(new Date(step.dueAt), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(step);
      map.set(key, list);
    }
    return map;
  }, [planSteps]);

  return (
    <div className="space-y-6">
      <CalendarAddPlanDialog
        open={!!addPlanDay}
        day={addPlanDay}
        matters={matters}
        workTypes={workTypes}
        onClose={() => setAddPlanDay(null)}
      />
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
              {t("scopeMine")}
            </Button>
            <Button
              size="sm"
              variant={scope === "all" ? "default" : "ghost"}
              onClick={() => router.push("/calendar?scope=all")}
            >
              {t("scopeAll")}
            </Button>
          </div>
        )}
      </div>

      <Card className="surface">
        <CardHeader>
          <CardTitle>{t("monthGrid")}</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            {t("monthGridHint")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-0 p-0.5 sm:p-1">
          <div className="grid min-w-0 grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:gap-2 sm:text-xs">
            {weekdayLabels.map((d) => (
              <div key={d} className="py-1 sm:py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid min-w-0 grid-cols-7 gap-0.5 sm:mt-0 sm:gap-2">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const dayPlans = plansByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAddPlanDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAddPlanDay(day);
                    }
                  }}
                  className={cn(
                    "interactive-press flex min-h-20 cursor-pointer flex-col rounded-md border p-0.5 text-left transition-colors duration-200 sm:min-h-36 sm:rounded-lg sm:p-2.5",
                    inMonth
                      ? "border-border bg-surface/80 hover:border-primary/30 hover:bg-primary-muted/40"
                      : "border-border/50 bg-muted/40 text-muted-foreground hover:bg-primary-muted/20",
                    isSameDay(day, new Date()) && "ring-2 ring-primary/40",
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-1">
                    <p className="text-[10px] font-semibold sm:text-xs">{format(day, "d")}</p>
                    <Plus className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" aria-hidden />
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
          </div>
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader>
          <CardTitle>{t("deadlineListTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monthTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDeadlinesThisMonth")}</p>
          ) : (
            monthTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant="info">{labels.taskStatus[task.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dueAt", { date: format(new Date(task.dueDate), "dd/MM/yyyy") })} •{" "}
                  {task.assigneeName}
                  {task.clientName ? ` • ${task.clientName}` : ""}
                  {task.matterCode ? ` • ${task.matterCode}` : ""}
                </p>
                <Badge variant="warning" className="mt-2">
                  {labels.taskPriority[task.priority]}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
