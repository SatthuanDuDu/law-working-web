"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createDepartmentAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";

export function DepartmentForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: "Xác nhận thêm phòng ban",
      message: `Bạn có chắc muốn thêm phòng ban "${name}"?`,
      confirmLabel: "Thêm phòng ban",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createDepartmentAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã thêm phòng ban");
          (document.getElementById("department-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form id="department-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tên phòng ban</Label>
        <Input id="name" name="name" required placeholder="Ví dụ: Dân sự" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Đang lưu..." : "Thêm phòng ban"}
      </Button>
    </form>
    </>
  );
}
