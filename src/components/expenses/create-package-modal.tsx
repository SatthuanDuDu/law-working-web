"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createPackageAction } from "@/lib/budget-package-actions";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/card";
import { formatVndDigits } from "@/lib/wallet";
import { cn } from "@/lib/utils";

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "");
}

export function CreatePackageModal({
  open,
  onClose,
  users,
}: {
  open: boolean;
  onClose: () => void;
  users: { id: string; name: string; username: string; role: string }[];
}) {
  const t = useTranslations("budgetPackage");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { mounted, active } = useOverlayAnimation(open);
  const [amountDigits, setAmountDigits] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setError("");
    setAmountDigits("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, handleClose]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("amountVnd", amountDigits);
    setError("");
    startTransition(async () => {
      const result = await createPackageAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      handleClose();
      router.refresh();
      if (result?.package?.id) {
        router.push(`/expenses/packages/${result.package.id}`);
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0",
        )}
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-package-title"
        className={cn(
          "relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-md border border-border bg-surface shadow-[var(--shadow-overlay)] transition-transform duration-200 sm:rounded-md",
          active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 sm:translate-y-2",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="create-package-title" className="text-sm font-semibold">
            {t("createTitle")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="interactive-press size-8"
            onClick={handleClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">{t("name")}</Label>
            <Input id="pkg-name" name="name" required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-owner">{t("owner")}</Label>
            <Select id="pkg-owner" name="ownerUserId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-amount">{t("amount")}</Label>
            <Input
              id="pkg-amount"
              inputMode="numeric"
              required
              value={formatVndDigits(amountDigits)}
              onChange={(e) => setAmountDigits(digitsOnly(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-note">{t("note")}</Label>
            <Input id="pkg-note" name="note" maxLength={500} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !amountDigits}>
              {pending ? t("creating") : t("createSubmit")}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
