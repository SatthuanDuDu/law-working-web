"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Flag,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FlowRailBaseStep = {
  title: string;
  description?: string | null;
};

type WorkflowFlowRailProps<T extends FlowRailBaseStep> = {
  steps: T[];
  onChange: (steps: T[]) => void;
  disabled?: boolean;
  defaultExpandedIndex?: number;
  getStepKey?: (step: T, index: number) => string;
  createEmptyStep?: () => T;
  renderExtra?: (ctx: {
    step: T;
    index: number;
    update: (patch: Partial<T>) => void;
  }) => ReactNode;
  renderCollapsedMeta?: (ctx: { step: T; index: number }) => ReactNode;
};

/** Same 2.25rem rail column as step rows — keeps the spine perfectly vertical. */
const RAIL_GRID = "grid grid-cols-[2.25rem_1fr] gap-x-3";

function RailSpine() {
  return (
    <div
      className="w-0.5 min-h-[0.5rem] flex-1 bg-border"
      aria-hidden
    />
  );
}

/** Compact gap; + / label only on hover (touch: faintly visible). */
function HoverInsertZone({
  disabled,
  onInsert,
  label,
}: {
  disabled?: boolean;
  onInsert: () => void;
  label: string;
}) {
  return (
    <div
      className={cn(
        RAIL_GRID,
        "group/insert h-2 hover:h-10 focus-within:h-10",
        "transition-[height] duration-150",
      )}
    >
      <div className="relative">
        {/* Same axis as step nodes: center of 2.25rem column */}
        <div
          className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-border"
          aria-hidden
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onInsert}
          aria-label={label}
          className={cn(
            "interactive-press absolute left-1/2 top-1/2 z-[1] flex -translate-y-1/2 items-center gap-1.5",
            /* Align + circle center on the spine (half of h-5 = 0.625rem) */
            "-translate-x-[0.625rem]",
            "h-7 rounded-full border border-dashed border-primary/35 bg-surface py-0 pl-0.5 pr-2.5",
            "text-xs font-medium text-primary",
            "opacity-0 pointer-events-none",
            "group-hover/insert:pointer-events-auto group-hover/insert:opacity-100",
            "group-focus-within/insert:pointer-events-auto group-focus-within/insert:opacity-100",
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-90",
            "disabled:opacity-40",
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-muted">
            <Plus className="h-3.5 w-3.5" />
          </span>
          <span className="whitespace-nowrap">{label}</span>
        </button>
      </div>
      <div aria-hidden />
    </div>
  );
}

function RailNode({
  children,
  active,
  variant = "step",
}: {
  children: ReactNode;
  active?: boolean;
  variant?: "start" | "step" | "end";
}) {
  return (
    <span
      className={cn(
        "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        "bg-canvas",
        variant === "start" && "bg-primary text-primary-foreground",
        variant === "end" && "border-2 border-border bg-surface text-muted-foreground",
        variant === "step" &&
          (active
            ? "bg-primary text-primary-foreground"
            : "border-2 border-primary/25 bg-surface text-primary"),
      )}
    >
      {children}
    </span>
  );
}

export function WorkflowFlowRail<T extends FlowRailBaseStep>({
  steps,
  onChange,
  disabled = false,
  defaultExpandedIndex = 0,
  getStepKey,
  createEmptyStep,
  renderExtra,
  renderCollapsedMeta,
}: WorkflowFlowRailProps<T>) {
  const t = useTranslations("workflows");
  const [expandedIndex, setExpandedIndex] = useState(defaultExpandedIndex);

  function stepKey(step: T, index: number) {
    return getStepKey?.(step, index) ?? `step-${index}`;
  }

  function updateStep(index: number, patch: Partial<T>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
    if (expandedIndex === index) setExpandedIndex(target);
    else if (expandedIndex === target) setExpandedIndex(index);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(Math.max(0, index - 1));
    } else if (expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  }

  function insertStep(atIndex: number) {
    const empty = createEmptyStep?.() ?? ({ title: "", description: "" } as T);
    const next = [...steps];
    next.splice(atIndex, 0, empty);
    onChange(next);
    setExpandedIndex(atIndex);
  }

  function appendStep() {
    insertStep(steps.length);
  }

  if (steps.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-canvas/80 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t("noStepsYet")}</p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => insertStep(0)}
          className="interactive-press mt-3"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t("addStep")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-canvas/60 p-3 sm:p-4">
      {/* Start */}
      <div className={RAIL_GRID}>
        <div className="flex flex-col items-center">
          <RailNode variant="start">
            <Play className="h-3 w-3 fill-current" />
          </RailNode>
          <RailSpine />
        </div>
        <div className="flex items-center gap-2 pb-1.5 pt-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {t("startMarker")}
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t("stepCount", { count: steps.length })}
          </span>
        </div>
      </div>

      {steps.map((step, index) => {
        const isExpanded = expandedIndex === index;
        const key = stepKey(step, index);
        const titlePreview = step.title.trim() || t("stepTitlePlaceholder");
        const descPreview = step.description?.trim();
        const isLast = index === steps.length - 1;

        return (
          <div key={key}>
            {index > 0 ? (
              <HoverInsertZone
                disabled={disabled}
                onInsert={() => insertStep(index)}
                label={t("addStep")}
              />
            ) : null}

            <div className={RAIL_GRID}>
              <div className="flex flex-col items-center">
                <RailNode active={isExpanded}>{index + 1}</RailNode>
                <RailSpine />
              </div>

              <div
                className={cn(
                  "overflow-hidden rounded-md border bg-surface transition-[border-color,box-shadow]",
                  isExpanded
                    ? "border-primary/35 shadow-[var(--shadow-card)]"
                    : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex border-l-[3px]",
                    isExpanded ? "border-l-primary" : "border-l-transparent",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-1 px-3 py-2">
                    <button
                      type="button"
                      disabled={disabled && !isExpanded}
                      onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                      className="interactive-press flex min-w-0 flex-1 items-start gap-2 text-left"
                      aria-expanded={isExpanded}
                      aria-label={t("expandStep", { number: index + 1 })}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground",
                          isExpanded && "bg-muted text-foreground",
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            !isExpanded && "-rotate-90",
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-foreground">
                          {titlePreview}
                        </span>
                        {!isExpanded ? (
                          <>
                            {descPreview ? (
                              <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                                {descPreview}
                              </span>
                            ) : null}
                            {renderCollapsedMeta?.({ step, index })}
                          </>
                        ) : null}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => moveStep(index, -1)}
                        className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label={t("moveUp")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || isLast}
                        onClick={() => moveStep(index, 1)}
                        className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label={t("moveDown")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      {isExpanded ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeStep(index)}
                          className="interactive-press rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          aria-label={t("removeStep")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="space-y-3 border-t border-border bg-muted/30 px-3 py-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`rail-title-${key}`}>{t("stepTitleLabel")}</Label>
                      <Input
                        id={`rail-title-${key}`}
                        value={step.title}
                        disabled={disabled}
                        onChange={(e) =>
                          updateStep(index, { title: e.target.value } as Partial<T>)
                        }
                        placeholder={t("stepTitlePlaceholder")}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`rail-desc-${key}`}>{t("stepDescriptionLabel")}</Label>
                      <Textarea
                        id={`rail-desc-${key}`}
                        value={step.description ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateStep(index, {
                            description: e.target.value,
                          } as Partial<T>)
                        }
                        placeholder={t("stepDescriptionPlaceholder")}
                        rows={2}
                        className="min-h-[4rem] resize-y"
                      />
                    </div>
                    {renderExtra?.({
                      step,
                      index,
                      update: (patch) => updateStep(index, patch),
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <HoverInsertZone disabled={disabled} onInsert={appendStep} label={t("addStep")} />

      <div className={RAIL_GRID}>
        <div className="flex flex-col items-center">
          <RailNode variant="end">
            <Flag className="h-3.5 w-3.5" />
          </RailNode>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("endMarker")}
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
      </div>
    </div>
  );
}
