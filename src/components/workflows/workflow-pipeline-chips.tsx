"use client";

import { cn } from "@/lib/utils";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";

export function WorkflowPipelineChips({
  steps,
  className,
}: {
  steps: WorkflowTemplateStepInput[];
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-y-1.5 rounded-md border border-border/80 bg-canvas/70 px-2.5 py-2",
        className,
      )}
      aria-hidden
    >
      {steps.map((step, index) => (
        <span key={`${index}-${step.title}`} className="inline-flex items-center">
          {index > 0 ? (
            <span
              className="mx-1.5 h-px w-3 shrink-0 bg-border sm:w-4"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "inline-flex max-w-[11rem] items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1",
              "text-xs text-foreground shadow-sm sm:max-w-[13rem]",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground">
              {index + 1}
            </span>
            <span className="truncate font-medium">{step.title.trim() || "…"}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
