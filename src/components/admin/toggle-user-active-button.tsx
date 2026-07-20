"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { setUserActiveAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToggleUserActiveButton({
  userId,
  userName,
  isActive,
  disabled = false,
  compact = false,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const tUsers = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const router = useRouter();

  function handleToggle() {
    const nextActive = !isActive;
    setError("");
    confirm({
      title: nextActive ? tUsers("confirmActivateTitle") : tUsers("confirmLockTitle"),
      message: nextActive
        ? tUsers("confirmActivateMessage", { name: userName })
        : tUsers("confirmLockMessage", { name: userName }),
      confirmLabel: nextActive ? tUsers("activateAccount") : tUsers("lockAccount"),
      cancelLabel: tCommon("cancel"),
      variant: nextActive ? "default" : "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await setUserActiveAction(userId, nextActive);
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      },
    });
  }

  const label = isActive ? tUsers("lockAccountShort") : tUsers("activateAccountShort");

  return (
    <div className="relative w-full">
      {dialog}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isPending}
        onClick={handleToggle}
        className={cn(
          "w-full gap-1.5",
          compact && "h-8 px-0 sm:px-2",
          isActive
            ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40"
            : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40",
        )}
        aria-label={
          isActive
            ? `${tUsers("lockAccount")} ${userName}`
            : `${tUsers("activateAccount")} ${userName}`
        }
      >
        {isActive ? (
          <Lock className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Unlock className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="hidden truncate sm:inline">{label}</span>
      </Button>
      {error ? (
        <p
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-max max-w-[12rem] -translate-x-1/2 rounded-md bg-surface px-2 py-1 text-center text-[10px] font-medium text-red-600 shadow-[var(--shadow-overlay)] ring-1 ring-border"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
