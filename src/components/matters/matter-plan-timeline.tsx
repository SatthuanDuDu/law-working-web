"use client";

import { useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import type { MatterPlanStepStatus } from "@prisma/client";
import {
  createMatterPlanStepAction,
  deleteMatterPlanStepAction,
  reorderMatterPlanStepsAction,
  updateMatterPlanStepAction,
} from "@/lib/actions";
import { MATTER_PLAN_STEP_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, cn } from "@/lib/utils";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Select } from "@/components/ui/card";
import {
  CommentThread,
  type CommentItem,
  type CommentMentionUser,
} from "@/components/comments/comment-thread";

export type MatterPlanStepItem = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  startedAt: string | null;
  dueAt: string | null;
  statusChangedAt: string | null;
  sortOrder: number;
  workType: { id: string; name: string } | null;
  comments: CommentItem[];
};

const STATUS_DOT_CLASS: Record<MatterPlanStepStatus, string> = {
  NOT_STARTED: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  DONE: "plan-step-dot-done bg-primary",
  BLOCKED: "bg-red-500",
};

const STATUS_DOT_PING_CLASS: Record<MatterPlanStepStatus, string> = {
  NOT_STARTED: "bg-slate-400/70",
  IN_PROGRESS: "bg-sky-400/80",
  DONE: "bg-primary/60",
  BLOCKED: "bg-red-400/80",
};

const outlinedFieldLabelClass =
  "pointer-events-none absolute left-3 top-0 z-[1] -translate-y-1/2 bg-white px-1.5 text-sm font-medium text-slate-700";

const outlinedFieldInputClass =
  "interactive-field h-11 min-w-0 max-w-full w-full rounded-[5px] border border-slate-300 bg-white px-3 pb-2.5 pt-3 text-sm";

function OutlinedField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <Label htmlFor={htmlFor} className={outlinedFieldLabelClass}>
        {label}
      </Label>
    </div>
  );
}

function reorderList(
  list: MatterPlanStepItem[],
  fromId: string,
  toId: string,
): MatterPlanStepItem[] {
  if (fromId === toId) return list;
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

export function MatterPlanTimeline({
  matterId,
  steps,
  workTypes,
  canEdit,
  currentUserId,
  canModerate,
  mentionUsers,
}: {
  matterId: string;
  steps: MatterPlanStepItem[];
  workTypes: { id: string; name: string }[];
  canEdit: boolean;
  currentUserId: string;
  canModerate: boolean;
  mentionUsers: CommentMentionUser[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [isAdding, startAddTransition] = useTransition();
  const [isUpdatingStep, startStepTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [orderedSteps, setOrderedSteps] = useState(steps);
  const [stepsSnapshot, setStepsSnapshot] = useState(steps);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  if (steps !== stepsSnapshot) {
    setStepsSnapshot(steps);
    setOrderedSteps(steps);
  }

  function refresh() {
    router.refresh();
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData();
    formData.set("matterId", matterId);
    formData.set("title", title.trim());
    formData.set("workTypeId", workTypeId);
    formData.set("startedAt", startedAt);
    formData.set("dueAt", dueAt);
    formData.set("status", "NOT_STARTED");

    startAddTransition(async () => {
      const result = await createMatterPlanStepAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setWorkTypeId("");
      setStartedAt("");
      setDueAt("");
      refresh();
    });
  }

  function handleStatusChange(stepId: string, status: MatterPlanStepStatus) {
    const formData = new FormData();
    formData.set("id", stepId);
    formData.set("status", status);
    startStepTransition(async () => {
      const result = await updateMatterPlanStepAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  function handleDelete(step: MatterPlanStepItem) {
    confirm({
      title: "Xóa bước kế hoạch",
      message: `Xóa hạng mục này?`,
      confirmLabel: "Xóa",
      variant: "destructive",
      onConfirm: () => {
        startStepTransition(async () => {
          const result = await deleteMatterPlanStepAction(step.id);
          if (result.error) {
            setError(result.error);
            return;
          }
          refresh();
        });
      },
    });
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, stepId: string) {
    if (!canEdit) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("select, button, a, input, textarea, label, [data-no-drag]")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stepId);
    setDraggingId(stepId);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, stepId: string) {
    if (!canEdit || !draggingId || draggingId === stepId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(stepId);
  }

  function handleDragLeave(stepId: string) {
    setDropTargetId((current) => (current === stepId ? null : current));
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    if (!canEdit) return;
    event.preventDefault();
    const fromId = event.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDropTargetId(null);
    if (!fromId || fromId === targetId) return;

    const previous = orderedSteps;
    const next = reorderList(orderedSteps, fromId, targetId);
    setOrderedSteps(next);

    startStepTransition(async () => {
      const result = await reorderMatterPlanStepsAction(
        matterId,
        next.map((step) => step.id),
      );
      if (result.error) {
        setError(result.error);
        setOrderedSteps(previous);
        return;
      }
      refresh();
    });
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  return (
    <>
      {dialog}
      <div className="min-w-0 space-y-6">
        {canEdit ? (
          <form
            onSubmit={handleAdd}
            className="min-w-0 space-y-5 rounded-[5px] border border-slate-200 bg-white p-3 sm:p-4"
          >
            <p className="text-sm font-semibold text-slate-800">Thêm bước kế hoạch</p>
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <OutlinedField label="Loại công việc" htmlFor="plan-step-work-type">
                <div className="relative">
                  <Select
                    id="plan-step-work-type"
                    value={workTypeId}
                    onChange={(event) => setWorkTypeId(event.target.value)}
                    className={cn(outlinedFieldInputClass, "appearance-none pr-10")}
                  >
                    <option value="">— Chọn loại —</option>
                    {workTypes.map((workType) => (
                      <option key={workType.id} value={workType.id}>
                        {workType.name}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />
                </div>
              </OutlinedField>

              <OutlinedField
                label="Chi tiết công việc"
                htmlFor="plan-step-title"
                className="sm:col-span-2"
              >
                <Textarea
                  id="plan-step-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Mô tả cụ thể công việc cần làm..."
                  required
                  rows={3}
                  className={cn(outlinedFieldInputClass, "h-auto min-h-[5.5rem] resize-y")}
                />
              </OutlinedField>

              <OutlinedField label="Thời gian diễn ra" htmlFor="plan-step-started">
                <Input
                  id="plan-step-started"
                  type="datetime-local"
                  value={startedAt}
                  onChange={(event) => setStartedAt(event.target.value)}
                  className={outlinedFieldInputClass}
                />
              </OutlinedField>

              <OutlinedField label="Thời gian dự kiến hoàn thành" htmlFor="plan-step-due">
                <Input
                  id="plan-step-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className={outlinedFieldInputClass}
                />
              </OutlinedField>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={isAdding || !title.trim()}>
              <Plus className="h-4 w-4" />
              {isAdding ? "Đang thêm..." : "Thêm vào kế hoạch"}
            </Button>
          </form>
        ) : null}

        {orderedSteps.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có bước kế hoạch. {canEdit ? "Thêm hạng mục phía trên để bắt đầu." : ""}
          </p>
        ) : (
          <ol className="relative ml-0 min-w-0 space-y-0 border-l-2 border-slate-200 pl-6 pt-1.5 sm:ml-1 sm:pl-8">
            {orderedSteps.map((step, index) => {
              const isDragging = draggingId === step.id;
              const isDropTarget = dropTargetId === step.id && draggingId !== step.id;

              return (
                <li
                  key={step.id}
                  className={cn(
                    "relative pb-8 last:pb-0 transition-transform",
                    isDragging && "opacity-60",
                  )}
                  onDragOver={(event) => handleDragOver(event, step.id)}
                  onDragLeave={() => handleDragLeave(step.id)}
                  onDrop={(event) => handleDrop(event, step.id)}
                >
                  <div
                    draggable={canEdit}
                    onDragStart={(event) => handleDragStart(event, step.id)}
                    onDragEnd={handleDragEnd}
                    title={canEdit ? "Kéo thẻ để đổi thứ tự bước" : undefined}
                    className={cn(
                      "group relative min-w-0 rounded-[5px] border border-slate-200 bg-white p-3 shadow-sm transition-colors sm:p-4",
                      canEdit &&
                        "cursor-grab active:cursor-grabbing hover:border-primary/35 hover:bg-slate-50/60",
                      isDropTarget && "border-primary bg-primary-muted/40",
                      isDragging && "border-dashed border-primary/50",
                    )}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center"
                    >
                      <span
                        className={cn(
                          "plan-step-dot-ping absolute inset-0 rounded-full",
                          STATUS_DOT_PING_CLASS[step.status],
                        )}
                      />
                      <span
                        className={cn(
                          "relative h-3.5 w-3.5 rounded-full ring-2 ring-white",
                          STATUS_DOT_CLASS[step.status],
                        )}
                      />
                    </span>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-2">
                        {canEdit ? (
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-7 shrink-0 items-center justify-center rounded-[5px] text-slate-300 transition-colors",
                              "group-hover:bg-primary-muted group-hover:text-primary",
                            )}
                            aria-hidden
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Bước {index + 1}
                          </p>
                          <p className="break-words whitespace-pre-wrap font-semibold text-slate-900">
                            {step.title}
                          </p>
                          <div className="grid min-w-0 gap-1 text-sm text-slate-600 sm:grid-cols-2">
                            <p className="break-words">
                              <span className="font-medium text-slate-700">Loại công việc:</span>{" "}
                              {step.workType?.name ?? "—"}
                            </p>
                            <p className="break-words">
                              <span className="font-medium text-slate-700">Diễn ra:</span>{" "}
                              {step.startedAt ? formatDateTime(step.startedAt) : "—"}
                            </p>
                            <p className="break-words">
                              <span className="font-medium text-slate-700">
                                Dự kiến hoàn thành:
                              </span>{" "}
                              {step.dueAt ? formatDateTime(step.dueAt) : "—"}
                            </p>
                            <p className="break-words sm:col-span-2">
                              <span className="font-medium text-slate-700">Trạng thái:</span>{" "}
                              {MATTER_PLAN_STEP_STATUS_LABELS[step.status]}
                              {step.statusChangedAt
                                ? ` • ${formatDateTime(step.statusChangedAt)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                      {canEdit ? (
                        <div
                          data-no-drag
                          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <div className="relative w-full sm:w-auto">
                            <Select
                              value={step.status}
                              disabled={isUpdatingStep}
                              onChange={(event) =>
                                handleStatusChange(
                                  step.id,
                                  event.target.value as MatterPlanStepStatus,
                                )
                              }
                              className="h-9 w-full min-w-0 appearance-none rounded-[5px] py-0 pl-3 pr-9 text-center sm:w-auto sm:min-w-[10rem]"
                              aria-label="Trạng thái bước kế hoạch"
                            >
                              {(
                                Object.keys(
                                  MATTER_PLAN_STEP_STATUS_LABELS,
                                ) as MatterPlanStepStatus[]
                              ).map((status) => (
                                <option key={status} value={status}>
                                  {MATTER_PLAN_STEP_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </Select>
                            <ChevronDown
                              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                              aria-hidden
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isUpdatingStep}
                            onClick={() => handleDelete(step)}
                            aria-label="Xóa bước"
                            className="rounded-[5px] text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div
                      data-no-drag
                      className="mt-3 border-t border-slate-100 pt-3"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <CommentThread
                        matterId={matterId}
                        matterPlanStepId={step.id}
                        currentUserId={currentUserId}
                        canModerate={canModerate}
                        canPost={canEdit}
                        mentionUsers={mentionUsers}
                        comments={step.comments}
                        compact
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
