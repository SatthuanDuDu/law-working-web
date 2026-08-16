"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteTaskAction, updateTaskAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  OutlinedField,
  OutlinedSelect,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";
import { toVietnamDateInput } from "@/lib/datetime";

export type TaskDetailItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  assigneeId: string;
  createdById: string;
  matterId: string | null;
};

export function TaskDetailPanel({
  task,
  open,
  onClose,
  users,
  matters,
  canDelete,
  onSaved,
}: {
  task: TaskDetailItem | null;
  open: boolean;
  onClose: () => void;
  users: { id: string; name: string }[];
  matters: { id: string; code: string; title: string }[];
  canDelete: boolean;
  onSaved?: () => void;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const { taskStatus, taskPriority } = useLabelMaps();
  const { mounted, active } = useOverlayAnimation(open);
  const { confirm, dialog } = useConfirmDialog();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!mounted || typeof document === "undefined" || !task) return null;

  const dueValue = task.dueDate ? toVietnamDateInput(task.dueDate) : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("id", task!.id);
    setError("");
    startTransition(async () => {
      const result = await updateTaskAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved?.();
      onClose();
    });
  }

  function handleDelete() {
    confirm({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteMessage", { title: task!.title }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteTaskAction(task!.id);
          if (result.error) {
            setError(result.error);
            return;
          }
          onSaved?.();
          onClose();
        });
      },
    });
  }

  return createPortal(
    <>
      {dialog}
      <div className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-stretch justify-end p-0 sm:p-6 sm:pl-0">
        <button
          type="button"
          aria-label={tCommon("close")}
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
          className={cn(
            "overlay-panel relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0 pr-3">
              <h2
                id="task-detail-title"
                className="text-lg font-semibold text-primary"
              >
                {t("detailTitle")}
              </h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {task.title}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={tCommon("close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form
            key={task.id}
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <OutlinedField label={t("titleLabel")} htmlFor="task-edit-title">
                <Input
                  id="task-edit-title"
                  name="title"
                  required
                  defaultValue={task.title}
                  className={outlinedFieldControlClass}
                />
              </OutlinedField>

              <OutlinedField
                label={t("descriptionLabel")}
                htmlFor="task-edit-description"
              >
                <Textarea
                  id="task-edit-description"
                  name="description"
                  rows={3}
                  defaultValue={task.description ?? ""}
                  className={outlinedFieldControlClass}
                />
              </OutlinedField>

              <div className="grid gap-4 sm:grid-cols-2">
                <OutlinedSelect
                  label={t("statusLabel")}
                  id="task-edit-status"
                  name="status"
                  defaultValue={task.status}
                >
                  {Object.entries(taskStatus).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </OutlinedSelect>
                <OutlinedSelect
                  label={t("priorityLabel")}
                  id="task-edit-priority"
                  name="priority"
                  defaultValue={task.priority}
                >
                  {Object.entries(taskPriority).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </OutlinedSelect>
              </div>

              <OutlinedField label={t("dueDateLabel")} htmlFor="task-edit-due">
                <Input
                  id="task-edit-due"
                  name="dueDate"
                  type="date"
                  defaultValue={dueValue}
                  className={outlinedFieldControlClass}
                />
              </OutlinedField>

              <OutlinedSelect
                label={t("assigneeLabel")}
                id="task-edit-assignee"
                name="assigneeId"
                required
                defaultValue={task.assigneeId}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </OutlinedSelect>

              <OutlinedSelect
                label={t("matterLabel")}
                id="task-edit-matter"
                name="matterId"
                defaultValue={task.matterId ?? ""}
              >
                <option value="">{t("noMatter")}</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.code} — {matter.title}
                  </option>
                ))}
              </OutlinedSelect>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 sm:px-6">
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isPending}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {tCommon("delete")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {tCommon("save")}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
