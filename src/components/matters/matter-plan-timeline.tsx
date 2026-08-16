"use client";

import { useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { MatterPlanStepStatus, TaskPriority } from "@prisma/client";
import {
  planStepStatusChipClass,
  StatusChip,
  taskPriorityChipClass,
} from "@/components/ui/status-chip";
import {
  deleteMatterPlanStepAction,
  reorderMatterPlanStepsAction,
  updateMatterPlanStepAction,
} from "@/lib/actions";
import { formatDateTime, cn } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useLocale, useTranslations } from "next-intl";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { DatetimeLocalWithNow } from "@/components/ui/datetime-local-with-now";
import { Textarea } from "@/components/ui/textarea";
import { Label, Select } from "@/components/ui/card";
import {
  CommentThread,
  type CommentItem,
  type CommentMentionUser,
} from "@/components/comments/comment-thread";
import {
  AttachmentPanel,
  type AttachmentItem,
} from "@/components/attachments/attachment-panel";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MatterPlanAddDialog } from "@/components/matters/matter-plan-add-dialog";
import { PlanAssigneeMultiSelect } from "@/components/matters/plan-assignee-multi-select";
import { LocationPicker } from "@/components/location/location-picker";
import { LocationChip } from "@/components/location/location-chip";
import {
  appendLocationToFormData,
  locationFromPrismaFields,
  type LocationValue,
} from "@/lib/location";

export type MatterPlanStepItem = {
  id: string;
  title: string;
  status: MatterPlanStepStatus;
  priority: TaskPriority;
  startedAt: string | null;
  dueAt: string | null;
  statusChangedAt: string | null;
  sortOrder: number;
  workType: { id: string; name: string } | null;
  assignees: {
    id: string;
    name: string;
    avatarKey: string | null;
  }[];
  locationName: string | null;
  locationAddress: string | null;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  comments: CommentItem[];
  attachments: AttachmentItem[];
};

const PRIORITY_OPTIONS: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const fieldLabelClass = "block text-sm font-medium text-foreground";

const outlinedFieldInputClass =
  "interactive-field h-11 min-w-0 max-w-full w-full rounded-md border border-border bg-surface px-3 py-0 text-sm leading-normal text-foreground";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function StepMetaItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        {label}
      </dt>
      <dd className="mt-0.5 min-w-0 break-words text-sm font-medium leading-snug text-foreground">
        {children}
      </dd>
    </div>
  );
}

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
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </Label>
      {children}
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

type EditDraft = {
  title: string;
  workTypeId: string;
  assigneeIds: string[];
  startedAt: string;
  dueAt: string;
  priority: TaskPriority;
  location: LocationValue | null;
};

export function MatterPlanTimeline({
  matterId,
  steps,
  workTypes,
  assigneeOptions,
  canEdit,
  canUploadDocuments = false,
  canComment = false,
  canManageAccess = false,
  currentUserId,
  canModerate,
  canDeleteAsAdmin,
  mentionUsers,
}: {
  matterId: string;
  steps: MatterPlanStepItem[];
  workTypes: { id: string; name: string }[];
  assigneeOptions: { id: string; name: string }[];
  canEdit: boolean;
  canUploadDocuments?: boolean;
  canComment?: boolean;
  canManageAccess?: boolean;
  currentUserId: string;
  canModerate: boolean;
  canDeleteAsAdmin: boolean;
  mentionUsers: CommentMentionUser[];
}) {
  const router = useRouter();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { planStepStatus } = useLabelMaps();
  const { confirm, dialog } = useConfirmDialog();
  const [isUpdatingStep, startStepTransition] = useTransition();
  const [error, setError] = useState("");
  const [orderedSteps, setOrderedSteps] = useState(steps);
  const [stepsSnapshot, setStepsSnapshot] = useState(steps);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});

  if (steps !== stepsSnapshot) {
    setStepsSnapshot(steps);
    setOrderedSteps(steps);
    if (editingId && !steps.some((step) => step.id === editingId)) {
      setEditingId(null);
      setEditDraft(null);
      setEditError("");
    }
  }

  function refresh() {
    router.refresh();
  }

  function beginEdit(step: MatterPlanStepItem) {
    setEditingId(step.id);
    setEditDraft({
      title: step.title,
      workTypeId: step.workType?.id ?? "",
      assigneeIds: step.assignees.map((user) => user.id),
      startedAt: toDatetimeLocalValue(step.startedAt),
      dueAt: toDatetimeLocalValue(step.dueAt),
      priority: step.priority,
      location: locationFromPrismaFields(step),
    });
    setEditError("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError("");
  }

  function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editDraft) return;
    const nextTitle = editDraft.title.trim();
    if (!nextTitle) {
      setEditError(t("titleRequired"));
      return;
    }
    setEditError("");
    const formData = new FormData();
    formData.set("id", editingId);
    formData.set("title", nextTitle);
    formData.set("workTypeId", editDraft.workTypeId);
    for (const id of editDraft.assigneeIds) formData.append("assigneeIds", id);
    formData.set("startedAt", editDraft.startedAt);
    formData.set("dueAt", editDraft.dueAt);
    formData.set("priority", editDraft.priority);
    appendLocationToFormData(formData, editDraft.location);

    startStepTransition(async () => {
      const result = await updateMatterPlanStepAction(formData);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      const startedIso = editDraft.startedAt
        ? new Date(editDraft.startedAt).toISOString()
        : null;
      const dueIso = editDraft.dueAt
        ? new Date(editDraft.dueAt).toISOString()
        : null;
      const nextWorkType =
        workTypes.find((item) => item.id === editDraft.workTypeId) ?? null;
      const assigneeById = new Map(
        [...assigneeOptions, ...orderedSteps.flatMap((s) => s.assignees)].map(
          (user) => [user.id, user],
        ),
      );
      setOrderedSteps((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                title: nextTitle,
                workType: nextWorkType,
                assignees: editDraft.assigneeIds.flatMap((id) => {
                  const user = assigneeById.get(id);
                  if (!user) return [];
                  return [
                    {
                      id: user.id,
                      name: user.name,
                      avatarKey:
                        "avatarKey" in user && typeof user.avatarKey === "string"
                          ? user.avatarKey
                          : null,
                    },
                  ];
                }),
                startedAt: startedIso,
                dueAt: dueIso,
                priority: editDraft.priority,
                locationName: editDraft.location?.name ?? null,
                locationAddress: editDraft.location?.address ?? null,
                locationPlaceId: editDraft.location?.placeId ?? null,
                locationLat: editDraft.location?.lat ?? null,
                locationLng: editDraft.location?.lng ?? null,
              }
            : item,
        ),
      );
      cancelEdit();
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
      title: t("deleteTitle"),
      message: t("deleteConfirm"),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startStepTransition(async () => {
          const result = await deleteMatterPlanStepAction(step.id);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (editingId === step.id) cancelEdit();
          refresh();
        });
      },
    });
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, stepId: string) {
    if (!canEdit || editingId) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "select, button, a, input, textarea, label, [data-no-drag]",
      )
    ) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stepId);
    setDraggingId(stepId);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, stepId: string) {
    if (!canEdit || !draggingId || draggingId === stepId || editingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(stepId);
  }

  function handleDragLeave(stepId: string) {
    setDropTargetId((current) => (current === stepId ? null : current));
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    if (!canEdit || editingId) return;
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

  function toggleDocs(stepId: string) {
    setExpandedDocs((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  }

  const existingSummaries = orderedSteps.map((step) => ({
    id: step.id,
    title: step.title,
    status: step.status,
    dueAt: step.dueAt,
    sortOrder: step.sortOrder,
  }));

  return (
    <>
      {dialog}
      <MatterPlanAddDialog
        open={addOpen}
        matterId={matterId}
        workTypes={workTypes}
        assigneeOptions={assigneeOptions}
        existingSteps={existingSummaries}
        onClose={() => setAddOpen(false)}
      />

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t("title")}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("subtitle")}
              {orderedSteps.length > 0
                ? ` · ${t("stepCount", { count: orderedSteps.length })}`
                : ""}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="interactive-press shrink-0"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("addStep")}
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {orderedSteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t("empty")}
            </p>
            {canEdit ? (
              <Button
                type="button"
                onClick={() => setAddOpen(true)}
                className="interactive-press"
              >
                <Plus className="h-4 w-4" />
                {t("addFirstStep")}
              </Button>
            ) : null}
          </div>
        ) : (
          <ol className="relative ml-0 min-w-0 space-y-0 border-l-2 border-primary/40 pl-5 pt-1 @md/workspace:ml-1 @md/workspace:pl-7 @xl/workspace:ml-2 @xl/workspace:pl-9">
            {orderedSteps.map((step, index) => {
              const isDragging = draggingId === step.id;
              const isDropTarget =
                dropTargetId === step.id && draggingId !== step.id;
              const isEditing = editingId === step.id && editDraft;
              const docsOpen = Boolean(expandedDocs[step.id]);
              const docsCount =
                step.attachments.length + step.comments.length;

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
                    draggable={canEdit && !editingId}
                    onDragStart={(event) => handleDragStart(event, step.id)}
                    onDragEnd={handleDragEnd}
                    title={
                      canEdit && !editingId
                        ? t("dragHint")
                        : undefined
                    }
                    className={cn(
                      "@container/step group relative min-w-0 rounded-md border border-border/50 bg-[color-mix(in_oklab,var(--muted)_8%,var(--surface))] p-3 transition-[border-color,background-color,transform] duration-150 @min-[28rem]/step:p-4",
                      canEdit &&
                        !editingId &&
                        "cursor-grab active:cursor-grabbing",
                      isDropTarget &&
                        "z-[1] border-primary bg-primary-muted ring-1 ring-primary/30",
                      isDragging && "border-dashed border-primary/60 bg-primary-muted/50 opacity-70",
                      isEditing &&
                        "border-primary/50 bg-surface ring-1 ring-primary/25",
                    )}
                  >
                    <div className="flex flex-col gap-3 @min-[32rem]/step:flex-row @min-[32rem]/step:items-start @min-[32rem]/step:justify-between">
                      <div className="flex min-w-0 flex-1 gap-2">
                        {canEdit && !isEditing ? (
                          <span
                            className="mt-0.5 flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                            aria-hidden
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold uppercase tracking-wide text-primary">
                              {isEditing
                                ? t("stepEditing", { n: index + 1 })
                                : t("stepLabel", { n: index + 1 })}
                            </p>
                          </div>
                          {isEditing ? (
                            <form
                              data-no-drag
                              onSubmit={handleSaveEdit}
                              className="min-w-0 space-y-5"
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <OutlinedField
                                label={t("detail")}
                                htmlFor={`edit-title-${step.id}`}
                              >
                                <Textarea
                                  id={`edit-title-${step.id}`}
                                  value={editDraft.title}
                                  onChange={(event) =>
                                    setEditDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            title: event.target.value,
                                          }
                                        : current,
                                    )
                                  }
                                  required
                                  rows={3}
                                  className={cn(
                                    outlinedFieldInputClass,
                                    "h-auto min-h-[5rem] resize-y py-2.5",
                                  )}
                                />
                              </OutlinedField>

                              <div className="grid min-w-0 gap-4 @min-[28rem]/step:grid-cols-2">
                                <OutlinedField
                                  label={t("workType")}
                                  htmlFor={`edit-work-type-${step.id}`}
                                >
                                  <div className="relative">
                                    <Select
                                      id={`edit-work-type-${step.id}`}
                                      value={editDraft.workTypeId}
                                      onChange={(event) =>
                                        setEditDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                workTypeId: event.target.value,
                                              }
                                            : current,
                                        )
                                      }
                                      className={cn(
                                        outlinedFieldInputClass,
                                        "appearance-none pr-10",
                                      )}
                                    >
                                      <option value="">{t("selectWorkType")}</option>
                                      {workTypes.map((workType) => (
                                        <option
                                          key={workType.id}
                                          value={workType.id}
                                        >
                                          {workType.name}
                                        </option>
                                      ))}
                                    </Select>
                                    <ChevronDown
                                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                      aria-hidden
                                    />
                                  </div>
                                </OutlinedField>

                                <OutlinedField
                                  label={t("importance")}
                                  htmlFor={`edit-priority-${step.id}`}
                                >
                                  <div className="relative">
                                    <Select
                                      id={`edit-priority-${step.id}`}
                                      value={editDraft.priority}
                                      onChange={(event) =>
                                        setEditDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                priority: event.target
                                                  .value as TaskPriority,
                                              }
                                            : current,
                                        )
                                      }
                                      className={cn(
                                        outlinedFieldInputClass,
                                        "appearance-none pr-10",
                                      )}
                                    >
                                      {PRIORITY_OPTIONS.map((priority) => (
                                        <option key={priority} value={priority}>
                                          {priority === "LOW"
                                            ? t("importanceLow")
                                            : priority === "MEDIUM"
                                              ? t("importanceMedium")
                                              : priority === "HIGH"
                                                ? t("importanceHigh")
                                                : t("importanceUrgent")}
                                        </option>
                                      ))}
                                    </Select>
                                    <ChevronDown
                                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                      aria-hidden
                                    />
                                  </div>
                                </OutlinedField>
                              </div>

                              <PlanAssigneeMultiSelect
                                id={`edit-assignee-${step.id}`}
                                options={[
                                  ...assigneeOptions,
                                  ...step.assignees.filter(
                                    (user) =>
                                      !assigneeOptions.some(
                                        (option) => option.id === user.id,
                                      ),
                                  ),
                                ]}
                                selectedIds={editDraft.assigneeIds}
                                onChange={(ids) =>
                                  setEditDraft((current) =>
                                    current
                                      ? { ...current, assigneeIds: ids }
                                      : current,
                                  )
                                }
                                disabled={isUpdatingStep}
                              />

                              <div className="grid min-w-0 gap-4 @min-[28rem]/step:grid-cols-2">
                                <DatetimeLocalWithNow
                                  id={`edit-started-${step.id}`}
                                  label={t("startedAt")}
                                  value={editDraft.startedAt}
                                  onChange={(next) =>
                                    setEditDraft((current) =>
                                      current
                                        ? { ...current, startedAt: next }
                                        : current,
                                    )
                                  }
                                />
                                <DatetimeLocalWithNow
                                  id={`edit-due-${step.id}`}
                                  label={t("dueAt")}
                                  value={editDraft.dueAt}
                                  onChange={(next) =>
                                    setEditDraft((current) =>
                                      current
                                        ? { ...current, dueAt: next }
                                        : current,
                                    )
                                  }
                                />
                              </div>

                              <OutlinedField
                                label={t("location")}
                                htmlFor={`edit-location-${step.id}`}
                              >
                                <LocationPicker
                                  id={`edit-location-${step.id}`}
                                  value={editDraft.location}
                                  onChange={(next) =>
                                    setEditDraft((current) =>
                                      current
                                        ? { ...current, location: next }
                                        : current,
                                    )
                                  }
                                  disabled={isUpdatingStep}
                                />
                              </OutlinedField>

                              {editError ? (
                                <p className="text-sm text-red-600">
                                  {editError}
                                </p>
                              ) : null}

                              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                                <Button
                                  type="submit"
                                  disabled={
                                    isUpdatingStep || !editDraft.title.trim()
                                  }
                                >
                                  {isUpdatingStep
                                    ? t("saving")
                                    : t("saveChanges")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={isUpdatingStep}
                                  onClick={cancelEdit}
                                >
                                  <X className="h-4 w-4" />
                                  {tCommon("cancel")}
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <p className="break-words whitespace-pre-wrap text-base font-semibold leading-snug text-foreground">
                                  {step.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <StatusChip
                                    label={planStepStatus[step.status]}
                                    className={cn(
                                      planStepStatusChipClass(step.status),
                                      "px-2 text-[11px] font-semibold",
                                    )}
                                  />
                                  <StatusChip
                                    label={
                                      step.priority === "LOW"
                                        ? t("importanceLow")
                                        : step.priority === "MEDIUM"
                                          ? t("importanceMedium")
                                          : step.priority === "HIGH"
                                            ? t("importanceHigh")
                                            : t("importanceUrgent")
                                    }
                                    className={cn(
                                      taskPriorityChipClass(step.priority),
                                      "px-2 text-[11px] font-semibold",
                                    )}
                                  />
                                </div>
                                {step.statusChangedAt ? (
                                  <p className="text-xs text-muted-foreground">
                                    {t("statusUpdated", {
                                      date: formatDateTime(
                                        step.statusChangedAt,
                                        locale,
                                      ),
                                    })}
                                  </p>
                                ) : null}
                              </div>

                              <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2.5 border-t border-border/70 pt-3 @min-[22rem]/step:grid-cols-2">
                                <StepMetaItem label={t("workTypeMeta")}>
                                  {step.workType?.name ?? "—"}
                                </StepMetaItem>
                                <StepMetaItem label={t("assigneeMeta")}>
                                  {step.assignees.length > 0 ? (
                                    <ul className="flex min-w-0 flex-wrap gap-x-3 gap-y-1.5">
                                      {step.assignees.map((user) => (
                                        <li
                                          key={user.id}
                                          className="flex min-w-0 max-w-full items-center gap-2"
                                        >
                                          <UserAvatar
                                            userId={user.id}
                                            name={user.name}
                                            avatarKey={user.avatarKey}
                                            size="sm"
                                            className="h-6 w-6 shrink-0 text-[10px]"
                                          />
                                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                                            {user.name}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    "—"
                                  )}
                                </StepMetaItem>
                                <StepMetaItem label={t("startedMeta")}>
                                  <span className="tabular-nums">
                                    {step.startedAt
                                      ? formatDateTime(step.startedAt, locale)
                                      : "—"}
                                  </span>
                                </StepMetaItem>
                                <StepMetaItem label={t("dueMeta")}>
                                  <span className="tabular-nums">
                                    {step.dueAt
                                      ? formatDateTime(step.dueAt, locale)
                                      : "—"}
                                  </span>
                                </StepMetaItem>
                                <StepMetaItem
                                  label={t("locationMeta")}
                                  className="@min-[22rem]/step:col-span-2"
                                >
                                  {(() => {
                                    const loc = locationFromPrismaFields(step);
                                    return loc ? (
                                      <LocationChip
                                        location={loc}
                                        className="w-auto max-w-full"
                                      />
                                    ) : (
                                      "—"
                                    );
                                  })()}
                                </StepMetaItem>
                              </dl>
                            </div>
                          )}
                        </div>
                      </div>
                      {canEdit ? (
                        <div
                          data-no-drag
                          className="flex w-full flex-wrap items-center gap-1.5 @min-[32rem]/step:w-auto @min-[32rem]/step:shrink-0"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          {!isEditing ? (
                            <>
                              <div className="relative min-w-0 flex-1 sm:flex-none">
                                <Select
                                  value={step.status}
                                  disabled={isUpdatingStep}
                                  onChange={(event) =>
                                    handleStatusChange(
                                      step.id,
                                      event.target
                                        .value as MatterPlanStepStatus,
                                    )
                                  }
                                  className="h-9 w-full min-w-0 appearance-none rounded-md py-0 pl-3 pr-9 text-center @min-[32rem]/step:w-auto @min-[32rem]/step:min-w-[10rem]"
                                  aria-label={t("statusLabel")}
                                >
                                  {(
                                    Object.keys(
                                      planStepStatus,
                                    ) as MatterPlanStepStatus[]
                                  ).map((status) => (
                                    <option key={status} value={status}>
                                      {planStepStatus[status]}
                                    </option>
                                  ))}
                                </Select>
                                <ChevronDown
                                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                  aria-hidden
                                />
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isUpdatingStep || Boolean(editingId)}
                                  onClick={() => beginEdit(step)}
                                  aria-label={t("editStep")}
                                  className="h-9 w-9 rounded-md text-muted-foreground hover:bg-primary-muted hover:text-primary"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isUpdatingStep}
                                  onClick={() => handleDelete(step)}
                                  aria-label={t("deleteStep")}
                                  className="h-9 w-9 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {!isEditing ? (
                      <div
                        data-no-drag
                        className="mt-3 min-w-0"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDocs(step.id)}
                          className="interactive-press flex w-full items-center justify-between gap-2 rounded-md px-0 py-1.5 text-left hover:bg-transparent hover:[filter:none] active:[filter:none]"
                          aria-expanded={docsOpen}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            {docsOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {t("docsTitle")}
                            {docsCount > 0 ? (
                              <span className="rounded-full bg-primary-muted px-1.5 py-0.5 text-[10px] tabular-nums font-semibold text-primary">
                                {docsCount}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {docsOpen ? tCommon("collapse") : tCommon("open")}
                          </span>
                        </button>
                        {docsOpen ? (
                          <div className="mt-2 space-y-5 border-t border-border/70 pt-3">
                            <AttachmentPanel
                              matterId={matterId}
                              matterPlanStepId={step.id}
                              currentUserId={currentUserId}
                              canDeleteAll={canModerate}
                              canUpload={canUploadDocuments}
                              canManageAccess={canManageAccess}
                              initialAttachments={step.attachments}
                              compact
                            />
                            <CommentThread
                              matterId={matterId}
                              matterPlanStepId={step.id}
                              currentUserId={currentUserId}
                              canDeleteAsAdmin={canDeleteAsAdmin}
                              canPost={canComment}
                              mentionUsers={mentionUsers}
                              comments={step.comments}
                              compact
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
