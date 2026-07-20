"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createTaskAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OutlinedField,
  OutlinedSelect,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";

export function TaskForm({
  users,
  matters,
}: {
  users: { id: string; name: string }[];
  matters: { id: string; code: string; title: string }[];
}) {
  const t = useTranslations("tasks");
  const { taskStatus, taskPriority } = useLabelMaps();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
          (document.getElementById("task-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader>
          <CardTitle>{t("formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="task-form" onSubmit={handleSubmit} className="space-y-5">
            <OutlinedField label={t("titleLabel")} htmlFor="title" className="mt-1">
              <Input
                id="title"
                name="title"
                required
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
            <OutlinedSelect id="assigneeId" name="assigneeId" label={t("assigneeLabel")} required>
              <option value="">{t("selectAssignee")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="matterId" name="matterId" label={t("matterLabel")}>
              <option value="">{t("noMatter")}</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>{m.code} - {m.title}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="priority" name="priority" label={t("priorityLabel")} defaultValue="MEDIUM">
              {Object.entries(taskPriority).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="status" name="status" label={t("statusLabel")} defaultValue="TODO">
              {Object.entries(taskStatus).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </OutlinedSelect>
            <OutlinedField label={t("dueDateLabel")} htmlFor="dueDate">
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                className={cn(outlinedFieldControlClass, "h-auto")}
              />
            </OutlinedField>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? t("assigning") : t("assignButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
