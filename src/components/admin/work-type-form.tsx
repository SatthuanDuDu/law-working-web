"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createWorkTypeAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";

export function WorkTypeForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: "Xác nhận thêm loại công việc",
      message: `Bạn có chắc muốn thêm loại công việc "${name}"?`,
      confirmLabel: "Thêm loại",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createWorkTypeAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã thêm loại công việc");
          (document.getElementById("work-type-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form id="work-type-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tên loại công việc</Label>
        <Input id="name" name="name" required placeholder="Ví dụ: Soạn thảo" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked className="rounded" />
        Đang sử dụng
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Đang lưu..." : "Thêm loại công việc"}
      </Button>
    </form>
    </>
  );
}
