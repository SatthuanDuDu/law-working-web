"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteUserButton({
  userId,
  userName,
  canDelete,
}: {
  userId: string;
  userName: string;
  canDelete: boolean;
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const router = useRouter();

  if (!canDelete) return null;

  function handleDelete() {
    setError("");
    setSuccess("");
    confirm({
      title: "Xóa nhân viên",
      message: `Bạn có chắc muốn xóa nhân viên "${userName}"? Hành động này không thể hoàn tác.`,
      confirmLabel: "Xóa",
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteUserAction(userId);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess("Đã xóa nhân viên");
          router.refresh();
        });
      },
    });
  }

  return (
    <div>
      {dialog}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-1 text-xs text-emerald-600">{success}</p>}
    </div>
  );
}
