"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTaskAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
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
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

export function TaskForm({
  users,
  matters,
}: {
  users: { id: string; name: string }[];
  matters: { id: string; code: string; title: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "");

    confirm({
      title: "Xác nhận giao việc",
      message: `Bạn có chắc muốn giao công việc "${title}"?`,
      confirmLabel: "Giao việc",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createTaskAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã giao việc");
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
          <CardTitle>Giao việc mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="task-form" onSubmit={handleSubmit} className="space-y-5">
            <OutlinedField label="Tiêu đề" htmlFor="title" className="mt-1">
              <Input
                id="title"
                name="title"
                required
                className={cn(outlinedFieldControlClass, "h-auto")}
              />
            </OutlinedField>
            <OutlinedField label="Mô tả" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={3}
                className={cn(outlinedFieldControlClass, "min-h-[5.5rem]")}
              />
            </OutlinedField>
            <OutlinedSelect id="assigneeId" name="assigneeId" label="Người nhận" required>
              <option value="">-- Chọn nhân viên --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="matterId" name="matterId" label="Vụ việc">
              <option value="">-- Không gắn vụ việc --</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>{m.code} - {m.title}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="priority" name="priority" label="Ưu tiên" defaultValue="MEDIUM">
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </OutlinedSelect>
            <OutlinedSelect id="status" name="status" label="Trạng thái" defaultValue="TODO">
              {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </OutlinedSelect>
            <OutlinedField label="Hạn hoàn thành" htmlFor="dueDate">
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
              {isPending ? "Đang giao..." : "Giao việc"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
