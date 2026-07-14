"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTaskAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
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
          <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigneeId">Người nhận</Label>
              <Select id="assigneeId" name="assigneeId" required>
                <option value="">-- Chọn nhân viên --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="matterId">Vụ việc</Label>
              <Select id="matterId" name="matterId">
                <option value="">-- Không gắn vụ việc --</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} - {m.title}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Ưu tiên</Label>
              <Select id="priority" name="priority" defaultValue="MEDIUM">
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Trạng thái</Label>
              <Select id="status" name="status" defaultValue="TODO">
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Hạn hoàn thành</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
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
