"use client";

import { useState, useTransition, type FormEvent } from "react";
import { changePasswordAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";

export function SettingsPageClient({ user }: { user: SessionUser }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    confirm({
      title: "Xác nhận đổi mật khẩu",
      message: "Bạn có chắc muốn đổi mật khẩu tài khoản của mình?",
      confirmLabel: "Đổi mật khẩu",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await changePasswordAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã đổi mật khẩu thành công");
          (document.getElementById("password-form") as HTMLFormElement)?.reset();
        });
      },
    });
  }

  return (
    <>
      {dialog}
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Họ tên:</span> {user.name}
          </p>
          <p>
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Vai trò:</span> {ROLE_LABELS[user.role]}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="password-form" onSubmit={handleSubmit} className="space-y-5">
            <OutlinedField label="Mật khẩu hiện tại" htmlFor="currentPassword" className="mt-1">
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                className={cn(outlinedFieldControlClass, "h-auto")}
              />
            </OutlinedField>
            <OutlinedField label="Mật khẩu mới" htmlFor="newPassword">
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                className={cn(outlinedFieldControlClass, "h-auto")}
              />
            </OutlinedField>
            <OutlinedField label="Xác nhận mật khẩu mới" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className={cn(outlinedFieldControlClass, "h-auto")}
              />
            </OutlinedField>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Đang lưu..." : "Đổi mật khẩu"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
