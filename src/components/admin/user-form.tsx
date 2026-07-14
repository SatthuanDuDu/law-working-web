"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createUserAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";

export function UserForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: "Xác nhận tạo nhân viên",
      message: `Bạn có chắc muốn tạo tài khoản cho "${name}"?`,
      confirmLabel: "Tạo nhân viên",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createUserAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã tạo nhân viên");
          (document.getElementById("user-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Họ tên</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input id="password" name="password" type="password" required minLength={6} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Vai trò</Label>
          <Select id="role" name="role" defaultValue="SUPPORT">
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="departmentId">Phòng ban</Label>
          <Select id="departmentId" name="departmentId">
            <option value="">-- Không chọn --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked className="rounded" />
          Đang hoạt động
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Đang tạo..." : "Tạo nhân viên"}
        </Button>
      </form>
    </>
  );
}
