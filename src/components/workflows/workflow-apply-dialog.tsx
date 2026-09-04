"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { DatetimeLocalWithNow } from "@/components/ui/datetime-local-with-now";
import { PlanAssigneeMultiSelect } from "@/components/matters/plan-assignee-multi-select";
import { WorkflowFlowRail } from "@/components/workflows/workflow-flow-rail";
import type {
  ActiveWorkflowTemplate,
  MatterPlanStepApplyDraft,
} from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

function newLocalId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function templateToDraft(
  template: ActiveWorkflowTemplate,
): MatterPlanStepApplyDraft[] {
  return template.steps.map((step) => ({
    localId: newLocalId(),
    title: step.title,
    description: step.description ?? "",
    startedAt: "",
    dueAt: "",
    assigneeIds: [],
  }));
}

function WorkflowApplyDialogBody({
  template,
  assigneeOptions,
  onClose,
  onApply,
}: {
  template: ActiveWorkflowTemplate;
  assigneeOptions: { id: string; name: string }[];
  onClose: () => void;
  onApply: (steps: MatterPlanStepApplyDraft[]) => void;
}) {
  const t = useTranslations("workflows.apply");
  const tPlan = useTranslations("plan");
  const tCommon = useTranslations("common");
  const [steps, setSteps] = useState(() => templateToDraft(template));
  const [error, setError] = useState("");

  function handleApply() {
    const validSteps = steps
      .map((step) => ({
        ...step,
        title: step.title.trim(),
        description: step.description.trim(),
      }))
      .filter((step) => step.title.length > 0);

    if (validSteps.length === 0) {
      setError(t("stepsRequired"));
      return;
    }

    onApply(validSteps);
    onClose();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {template.name}
            {template.description ? ` — ${template.description}` : ""}
          </p>
        </div>
        <button type="button" className="interactive-press rounded-md p-1" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>

        <WorkflowFlowRail
          steps={steps}
          onChange={setSteps}
          defaultExpandedIndex={0}
          getStepKey={(step) => step.localId}
          createEmptyStep={() => ({
            localId: newLocalId(),
            title: "",
            description: "",
            startedAt: "",
            dueAt: "",
            assigneeIds: [],
          })}
          renderCollapsedMeta={({ step }) =>
            step.assigneeIds.length > 0 ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("assigneeCount", { count: step.assigneeIds.length })}
              </span>
            ) : null
          }
          renderExtra={({ step, update }) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DatetimeLocalWithNow
                  id={`apply-start-${step.localId}`}
                  label={tPlan("startedAt")}
                  value={step.startedAt}
                  onChange={(value) => update({ startedAt: value })}
                />
                <DatetimeLocalWithNow
                  id={`apply-due-${step.localId}`}
                  label={tPlan("dueAt")}
                  value={step.dueAt}
                  onChange={(value) => update({ dueAt: value })}
                />
              </div>
              <PlanAssigneeMultiSelect
                id={`apply-assignees-${step.localId}`}
                options={assigneeOptions}
                selectedIds={step.assigneeIds}
                onChange={(assigneeIds) => update({ assigneeIds })}
              />
            </>
          )}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="interactive-press">
          {tCommon("cancel")}
        </Button>
        <Button type="button" onClick={handleApply} className="interactive-press">
          {t("applyButton")}
        </Button>
      </div>
    </>
  );
}

export function WorkflowApplyDialog({
  open,
  template,
  assigneeOptions,
  onClose,
  onApply,
}: {
  open: boolean;
  template: ActiveWorkflowTemplate;
  assigneeOptions: { id: string; name: string }[];
  onClose: () => void;
  onApply: (steps: MatterPlanStepApplyDraft[]) => void;
}) {
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        aria-label={tCommon("close")}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-md border border-border bg-surface shadow-[var(--shadow-overlay)] sm:rounded-md",
          active ? "translate-y-0" : "translate-y-4",
        )}
      >
        <WorkflowApplyDialogBody
          key={template.id}
          template={template}
          assigneeOptions={assigneeOptions}
          onClose={onClose}
          onApply={onApply}
        />
      </div>
    </div>,
    document.body,
  );
}
