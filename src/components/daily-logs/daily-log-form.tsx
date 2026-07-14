"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createDailyLogAction, updateDailyLogAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { DAILY_LOG_STATUS_LABELS } from "@/lib/constants";
import type { DailyLog, Client, Matter, User, WorkType } from "@prisma/client";

type LogWithRelations = DailyLog & {
  user: User;
  matter: Matter | null;
  client: Client | null;
  workType: WorkType | null;
};

export function DailyLogForm({
  matters,
  clients,
  workTypes,
  editing,
  onCancelEdit,
  onSaved,
}: {
  matters: { id: string; code: string; title: string }[];
  clients: { id: string; name: string }[];
  workTypes: { id: string; name: string }[];
  editing?: LogWithRelations | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [resetToken, setResetToken] = useState(0);
  const { confirm, dialog } = useConfirmDialog();

  const today = new Date().toISOString().split("T")[0];
  const isEditing = !!editing;
  const formKey = `${editing?.id ?? "new"}-${resetToken}`;

  const defaultDate = editing
    ? new Date(editing.date).toISOString().split("T")[0]
    : today;
  const defaultHours = editing ? Math.floor(editing.minutes / 60) : 1;
  const defaultMinutes = editing ? editing.minutes % 60 : 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    confirm({
      title: isEditing ? "Xác nhận cập nhật" : "Xác nhận ghi nhận công việc",
      message: isEditing
        ? "Bạn có chắc muốn cập nhật bản ghi công việc này?"
        : "Bạn có chắc muốn ghi nhận công việc này?",
      confirmLabel: isEditing ? "Cập nhật" : "Ghi nhận",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = isEditing
            ? await updateDailyLogAction(editing.id, formData)
            : await createDailyLogAction(formData);

          if (result.error) {
            setError(result.error);
            return;
          }

          setSuccess(isEditing ? "Đã cập nhật công việc" : "Đã ghi nhận công việc");
          onSaved?.();
          if (!isEditing) {
            setResetToken((k) => k + 1);
          }
        });
      },
    });
  }

  return (
    <>
      {dialog}
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Chỉnh sửa công việc" : "Ghi nhận nhanh"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          key={formKey}
          id="daily-log-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="date">Ngày</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={defaultDate}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Nội dung công việc</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={4}
              defaultValue={editing?.description ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="hours">Giờ</Label>
              <Input
                id="hours"
                name="hours"
                type="number"
                min={0}
                max={24}
                defaultValue={defaultHours}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Phút</Label>
              <Input
                id="minutes"
                name="minutes"
                type="number"
                min={0}
                max={59}
                defaultValue={defaultMinutes}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workTypeId">Loại công việc</Label>
            <Select
              id="workTypeId"
              name="workTypeId"
              defaultValue={editing?.workTypeId ?? ""}
            >
              <option value="">-- Chọn loại --</option>
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.id}>
                  {wt.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="matterId">Vụ việc</Label>
            <Select
              id="matterId"
              name="matterId"
              defaultValue={editing?.matterId ?? ""}
            >
              <option value="">-- Chọn vụ việc --</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientId">Khách hàng</Label>
            <Select
              id="clientId"
              name="clientId"
              defaultValue={editing?.clientId ?? ""}
            >
              <option value="">-- Chọn khách hàng --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <Select
              id="status"
              name="status"
              defaultValue={
                editing?.status === "REJECTED"
                  ? "PENDING_APPROVAL"
                  : editing?.status ?? "IN_PROGRESS"
              }
            >
              <option value="IN_PROGRESS">{DAILY_LOG_STATUS_LABELS.IN_PROGRESS}</option>
              <option value="PENDING_APPROVAL">
                {DAILY_LOG_STATUS_LABELS.PENDING_APPROVAL}
              </option>
              <option value="COMPLETED">{DAILY_LOG_STATUS_LABELS.COMPLETED}</option>
            </Select>
            {editing?.status === "REJECTED" && editing.rejectionNote && (
              <p className="text-xs text-red-600">
                Lần trước bị từ chối: {editing.rejectionNote}. Hãy chỉnh sửa và gửi duyệt lại.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isBillable"
              defaultChecked={editing?.isBillable ?? true}
              className="rounded"
            />
            Tính phí (billable)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending
                ? "Đang lưu..."
                : isEditing
                  ? "Cập nhật"
                  : "Ghi nhận công việc"}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                Hủy
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
}
