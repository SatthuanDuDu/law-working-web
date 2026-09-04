"use client";

import { WorkflowFlowRail } from "@/components/workflows/workflow-flow-rail";
import type { WorkflowTemplateStepInput } from "@/lib/workflow-types";

/** Thin wrapper — template editor uses shared flow rail. */
export function WorkflowStepsEditor({
  steps,
  onChange,
  disabled = false,
}: {
  steps: WorkflowTemplateStepInput[];
  onChange: (steps: WorkflowTemplateStepInput[]) => void;
  disabled?: boolean;
}) {
  return (
    <WorkflowFlowRail
      steps={steps}
      onChange={onChange}
      disabled={disabled}
      defaultExpandedIndex={0}
      createEmptyStep={() => ({ title: "", description: "" })}
    />
  );
}
