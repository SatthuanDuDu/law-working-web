import type {
  MatterPlanStepStatus,
  MatterStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  MATTER_STATUS_TONES,
  PLAN_STEP_STATUS_TONES,
  STATUS_TONE_PRESETS,
  TASK_PRIORITY_TONES,
  TASK_STATUS_TONES,
  type StatusTonePreset,
} from "@/lib/status-tokens";

const CHIP_BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function matterStatusChipClass(status: MatterStatus) {
  return cn(CHIP_BASE, MATTER_STATUS_TONES[status]);
}

export function taskStatusChipClass(status: TaskStatus) {
  return cn(CHIP_BASE, TASK_STATUS_TONES[status]);
}

export function planStepStatusChipClass(status: MatterPlanStepStatus) {
  return cn(CHIP_BASE, PLAN_STEP_STATUS_TONES[status]);
}

export function taskPriorityChipClass(priority: TaskPriority) {
  return cn(CHIP_BASE, TASK_PRIORITY_TONES[priority]);
}

export function StatusChip({
  label,
  tone,
  className,
}: {
  label: string;
  /** Preset key from status-tokens, or omit and pass `className` for full control. */
  tone?: StatusTonePreset;
  className?: string;
}) {
  return (
    <span
      className={cn(
        CHIP_BASE,
        tone ? STATUS_TONE_PRESETS[tone] : null,
        className,
      )}
    >
      {label}
    </span>
  );
}
