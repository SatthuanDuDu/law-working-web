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
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const router = useRouter();

  // Keep column alignment even when delete is unavailable.
  if (!canDelete) {
    return <div className="h-8 w-8 shrink-0" aria-hidden />;
  }

  function handleDelete() {
    setError("");
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
          router.refresh();
        });
      },
    });
  }

  return (
    <div className="relative">
      {dialog}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
        className="h-8 w-8 shrink-0 px-0 text-red-600 hover:bg-red-50 hover:text-red-700"
        aria-label={`Xóa ${userName}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error ? (
        <p
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-max max-w-[12rem] rounded-md bg-surface px-2 py-1 text-center text-[10px] font-medium text-red-600 shadow-[var(--shadow-overlay)] ring-1 ring-border"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
