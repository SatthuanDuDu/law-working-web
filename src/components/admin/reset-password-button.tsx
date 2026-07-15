"use client";

import { useState, useTransition, type FormEvent } from "react";
import { resetUserPasswordAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    confirm({
      title: "Xác nhận đặt lại mật khẩu",
      message: `Bạn có chắc muốn đặt lại mật khẩu cho "${userName}"?`,
      confirmLabel: "Đặt lại mật khẩu",
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await resetUserPasswordAction(userId, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã đặt lại mật khẩu");
          setOpen(false);
        });
      },
    });
  }

  if (!open) {
    return (
      <div>
        {dialog}
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Đặt lại MK
        </Button>
        {success && <p className="mt-1 text-xs text-emerald-600">{success}</p>}
      </div>
    );
  }

  return (
    <>
      {dialog}
      <form onSubmit={handleSubmit} className="flex w-full min-w-0 flex-col gap-2 sm:min-w-[220px]">
        <p className="text-xs text-slate-500">Đặt lại MK cho {userName}</p>
        <Input
          name="newPassword"
          type="password"
          placeholder="Mật khẩu mới"
          minLength={6}
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "..." : "Lưu"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Hủy
          </Button>
        </div>
      </form>
    </>
  );
}
