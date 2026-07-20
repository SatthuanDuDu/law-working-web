"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { resetUserPasswordAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ResetPasswordButton({
  userId,
  userName,
  compact = false,
}: {
  userId: string;
  userName: string;
  compact?: boolean;
}) {
  const t = useTranslations("admin");
  const tUsers = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    confirm({
      title: tUsers("confirmResetPasswordTitle"),
      message: tUsers("confirmResetPasswordMessage", { name: userName }),
      confirmLabel: t("resetPassword"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await resetUserPasswordAction(userId, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(tUsers("resetPasswordSuccess"));
          setOpen(false);
        });
      },
    });
  }

  return (
    <div className="relative w-full">
      {dialog}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("w-full gap-1.5", compact && "h-8 px-0 sm:px-2")}
        aria-label={`${t("resetPassword")} ${userName}`}
        aria-expanded={open}
      >
        <KeyRound className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden truncate sm:inline">
          {tUsers("resetPasswordShort")}
        </span>
      </Button>
      {success ? (
        <p
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-max max-w-[12rem] -translate-x-1/2 rounded-md bg-surface px-2 py-1 text-center text-[10px] font-medium text-emerald-700 shadow-[var(--shadow-overlay)] ring-1 ring-border"
          role="status"
        >
          {success}
        </p>
      ) : null}
      {open ? (
        <form
          onSubmit={handleSubmit}
          className="absolute right-0 top-full z-20 mt-1 flex w-[min(calc(100vw-2rem),16rem)] min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-overlay)] sm:min-w-[220px]"
        >
          <p className="text-xs text-muted-foreground">
            {tUsers("resetPasswordFor", { name: userName })}
          </p>
          <Input
            name="newPassword"
            type="password"
            placeholder={tUsers("newPasswordPlaceholder")}
            minLength={6}
            required
            className="h-9"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending} className="h-8">
              {isPending ? tCommon("saving") : tCommon("save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
