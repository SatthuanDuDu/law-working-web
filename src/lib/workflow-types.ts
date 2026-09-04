export type WorkflowTemplateStepInput = {
  title: string;
  description?: string | null;
};

export type WorkflowTemplateDraft = {
  name: string;
  description?: string | null;
  isActive: boolean;
  steps: WorkflowTemplateStepInput[];
};

export type MatterPlanStepApplyDraft = {
  localId: string;
  title: string;
  description: string;
  startedAt: string;
  dueAt: string;
  assigneeIds: string[];
};

export type ActiveWorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  steps: {
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
  }[];
};
