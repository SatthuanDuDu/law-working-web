export type AttachmentOriginKind =
  | "matter"
  | "plan_step"
  | "comment"
  | "task"
  | "client";

export type AttachmentOrigin = {
  kind: AttachmentOriginKind;
  label: string;
  matterCode?: string;
  matterTitle?: string;
  planStepTitle?: string;
};

export function buildAttachmentOrigin(input: {
  commentId?: string | null;
  matterPlanStepId?: string | null;
  matterId?: string | null;
  taskId?: string | null;
  clientId?: string | null;
  matterCode?: string | null;
  matterTitle?: string | null;
  planStepTitle?: string | null;
}): AttachmentOrigin {
  const matterCode = input.matterCode ?? undefined;
  const matterTitle = input.matterTitle ?? undefined;
  const planStepTitle = input.planStepTitle ?? undefined;

  if (input.commentId) {
    const label = planStepTitle
      ? `Bình luận · kế hoạch: ${planStepTitle}`
      : "Bình luận vụ việc";
    return {
      kind: "comment",
      label,
      matterCode,
      matterTitle,
      planStepTitle,
    };
  }

  if (input.matterPlanStepId) {
    return {
      kind: "plan_step",
      label: planStepTitle ? `Kế hoạch: ${planStepTitle}` : "Kế hoạch",
      matterCode,
      matterTitle,
      planStepTitle,
    };
  }

  if (input.matterId) {
    return {
      kind: "matter",
      label: "Vụ việc",
      matterCode,
      matterTitle,
    };
  }

  if (input.taskId) {
    return { kind: "task", label: "Công việc" };
  }

  if (input.clientId) {
    return { kind: "client", label: "Khách hàng" };
  }

  return { kind: "matter", label: "Tài liệu", matterCode, matterTitle };
}
