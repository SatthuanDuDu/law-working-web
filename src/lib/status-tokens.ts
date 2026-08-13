import type {
  MatterPlanStepStatus,
  MatterStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

/**
 * Soft Material You tonal surfaces for status / priority chips.
 * Prefer muted fills + readable text — never saturated white-on-color fills.
 *
 * Matter status palette (rule): NEW=sky, IN_PROGRESS=amber, ON_HOLD=rose, CLOSED=emerald.
 */

export const MATTER_STATUS_TONES: Record<MatterStatus, string> = {
  NEW: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  ON_HOLD: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  CLOSED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  ARCHIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export const TASK_STATUS_TONES: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

export const PLAN_STEP_STATUS_TONES: Record<MatterPlanStepStatus, string> = {
  NOT_STARTED:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  BLOCKED: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

export const TASK_PRIORITY_TONES: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

/** Named soft tones for generic StatusChip usage (not tied to an enum). */
export const STATUS_TONE_PRESETS = {
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  primary: "bg-primary-muted text-primary",
} as const;

export type StatusTonePreset = keyof typeof STATUS_TONE_PRESETS;
