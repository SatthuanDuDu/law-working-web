"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateWorkTypeAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";

export type EditWorkTypeInitial = {
  id: string;
  name: string;
  isActive: boolean;
};

export function EditWorkTypeModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: EditWorkTypeInitial;
}) {
  const router = useRouter();
  const t = useTranslations("admin.workTypes");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mounted, active } = useOverlayAnimation(open);

  const handleClose = useCallback(() => {
    setError("");
    setFormKey((key) => key + 1);
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
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();

    confirm({
      title: t("confirmUpdateTitle"),
      message: t("confirmUpdateMessage", { name }),
      confirmLabel: t("saveChanges"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        startTransition(async () => {
          const result = await updateWorkTypeAction(item.id, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          handleClose();
          router.refresh();
        });
      },
    });
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {dialog}
      <div className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-stretch justify-center p-0 sm:items-center sm:p-6">
        <button
          type="button"
          aria-label={t("closeFormAria")}
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-work-type-title"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[min(90dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2
                id="edit-work-type-title"
                className="text-lg font-semibold text-primary"
              >
                {t("editFormTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("editFormSubtitle")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label={tCommon("close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form
            key={`${item.id}-${formKey}`}
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label={t("nameLabel")} htmlFor="edit-work-type-name" className="mt-1">
                <Input
                  id="edit-work-type-name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={item.name}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={item.isActive}
                  className="rounded"
                />
                {t("activeLabel")}
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : t("saveChanges")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
