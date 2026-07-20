"use client";

import { useState, useTransition, type FormEvent } from "react";
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

  if (!open) {
    return (
      <div>
        {dialog}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(compact && "h-8 px-2.5")}
          aria-label={`${t("resetPassword")} ${userName}`}
        >
          {compact ? <KeyRound className="h-3.5 w-3.5" /> : null}
          <span className={compact ? "hidden sm:inline" : undefined}>
            {tUsers("resetPasswordShort")}
          </span>
        </Button>
        {success ? (
          <p className="mt-1 text-xs text-emerald-600">{success}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {dialog}
      <form
        onSubmit={handleSubmit}
        className="flex w-full min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-2 sm:min-w-[220px]"
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
    </>
  );
}
