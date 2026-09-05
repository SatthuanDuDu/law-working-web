"use client";

import { cn } from "@/lib/utils";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";

export function WorkflowPipelineChips({
  steps,
  className,
  variant = "chips",
}: {
  steps: WorkflowTemplateStepInput[];
  className?: string;
  /** `cards` = Nexus step tiles; `chips` = compact horizontal strip */
  variant?: "chips" | "cards";
}) {
  if (steps.length === 0) return null;

  if (variant === "cards") {
    const cols =
      steps.length <= 2
        ? "sm:grid-cols-2"
        : steps.length <= 4
          ? "sm:grid-cols-2 xl:grid-cols-4"
          : steps.length <= 5
            ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

    return (
      <div className={cn("grid grid-cols-1 gap-3", cols, className)}>
        {steps.map((step, index) => (
          <div
            key={`${index}-${step.title}`}
            className="space-y-1.5 rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container sm:p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold tabular-nums text-primary-foreground">
                {index + 1}
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug text-foreground">
              {step.title.trim() || "…"}
            </p>
            {step.description?.trim() ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {step.description.trim()}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

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
