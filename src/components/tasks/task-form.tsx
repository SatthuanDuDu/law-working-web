"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createTaskAction } from "@/lib/actions";
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

function TaskCreateForm({
  users,
  matters,
  onClose,
}: {
  users: { id: string; name: string }[];
  matters: { id: string; code: string; title: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const { taskStatus, taskPriority } = useLabelMaps();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "");

    confirm({
      title: t("confirmCreateTitle"),
      message: t("confirmCreateMessage", { title }),
      confirmLabel: t("assignButton"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createTaskAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(t("created"));
          form.reset();
          onClose();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form
        id="task-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <OutlinedField label={t("titleLabel")} htmlFor="title" className="mt-0">
            <Input
              id="title"
              name="title"
              required
              autoFocus
              className={cn(outlinedFieldControlClass, "h-auto")}
            />
          </OutlinedField>
          <OutlinedField label={t("descriptionLabel")} htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              className={cn(outlinedFieldControlClass, "min-h-[5.5rem]")}
            />
          </OutlinedField>
          <OutlinedSelect
            id="assigneeId"
            name="assigneeId"
            label={t("assigneeLabel")}
            required
          >
            <option value="">{t("selectAssignee")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </OutlinedSelect>
          <OutlinedSelect id="matterId" name="matterId" label={t("matterLabel")}>
            <option value="">{t("noMatter")}</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {m.title}
              </option>
            ))}
          </OutlinedSelect>
          <div className="grid gap-4 sm:grid-cols-2">
            <OutlinedSelect
              id="priority"
              name="priority"
              label={t("priorityLabel")}
              defaultValue="MEDIUM"
            >
              {Object.entries(taskPriority).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect
              id="status"
              name="status"
              label={t("statusLabel")}
              defaultValue="TODO"
            >
              {Object.entries(taskStatus).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </OutlinedSelect>
          </div>
          <OutlinedField label={t("dueDateLabel")} htmlFor="dueDate">
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              className={cn(outlinedFieldControlClass, "h-auto")}
            />
          </OutlinedField>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("assigning") : t("assignButton")}
          </Button>
        </div>
      </form>
    </>
  );
}

export function TaskForm({
  users,
  matters,
}: {
  users: { id: string; name: string }[];
  matters: { id: string; code: string; title: string }[];
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const { mounted, active } = useOverlayAnimation(open);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  return (
    <>
      <Button
        type="button"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-10 w-10 shrink-0 rounded-md p-0 [&_svg]:h-4 [&_svg]:w-4"
        aria-label={t("addButton")}
        title={t("addButton")}
      >
        <Plus aria-hidden />
      </Button>

      {mounted
        ? createPortal(
            <div className="fixed inset-0 z-[10000] flex items-end justify-center p-3 sm:items-center sm:p-6">
              <button
                type="button"
                aria-label={tCommon("close")}
                className={cn(
                  "overlay-backdrop absolute inset-0 bg-black/40",
                  active && "is-active",
                )}
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-form-title"
                className={cn(
                  "overlay-panel relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]",
                  active && "is-active",
                )}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <h2
                    id="task-form-title"
                    className="text-base font-semibold text-foreground"
                  >
                    {t("formTitle")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={tCommon("close")}
                    className="interactive-press rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <TaskCreateForm
                  key={open ? "open" : "closed"}
                  users={users}
                  matters={matters}
                  onClose={() => setOpen(false)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
