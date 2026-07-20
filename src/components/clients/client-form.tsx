"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClientAction, updateClientAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/card";
import {
  OutlinedField,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { VIETNAM_CITY_SUGGESTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ClientBusinessType } from "@prisma/client";

export type ClientFormInitial = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  businessType: ClientBusinessType | null;
  notes: string | null;
};

export function ClientFormModal({
  open,
  onClose,
  initial = null,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ClientFormInitial | null;
}) {
  const router = useRouter();
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();
  const isEdit = Boolean(initial);
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
      title: isEdit ? t("confirmUpdateTitle") : t("confirmCreateTitle"),
      message: isEdit
        ? t("confirmUpdateMessage", { name })
        : t("confirmCreateMessage", { name }),
      confirmLabel: isEdit ? t("saveChanges") : t("create"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        startTransition(async () => {
          const result =
            isEdit && initial
              ? await updateClientAction(initial.id, formData)
              : await createClientAction(formData);
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
          aria-labelledby="client-form-title"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[min(90dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2
                id="client-form-title"
                className="text-lg font-semibold text-primary"
              >
                {isEdit ? t("editFormTitle") : t("formTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isEdit ? t("editFormSubtitle") : t("formSubtitle")}
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
            key={`${initial?.id ?? "new"}-${formKey}`}
            id="client-form"
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label={t("name")} htmlFor="name" className="mt-1">
                <Input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={initial?.name ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={t("email")} htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initial?.email ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={t("phone")} htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={initial?.phone ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={t("city")} htmlFor="city">
                <Input
                  id="city"
                  name="city"
                  list="client-city-suggestions"
                  defaultValue={initial?.city ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
                <datalist id="client-city-suggestions">
                  {VIETNAM_CITY_SUGGESTIONS.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </OutlinedField>
              <OutlinedField label={t("address")} htmlFor="address">
                <Input
                  id="address"
                  name="address"
                  defaultValue={initial?.address ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={t("businessType")} htmlFor="businessType">
                <Select
                  id="businessType"
                  name="businessType"
                  defaultValue={initial?.businessType ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                >
                  <option value="">{t("selectBusinessType")}</option>
                  {Object.entries(labels.clientBusinessType).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </OutlinedField>
              <OutlinedField label={t("notes")} htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={initial?.notes ?? ""}
                  className={cn(outlinedFieldControlClass, "min-h-[5.5rem]")}
                />
              </OutlinedField>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? tCommon("saving")
                  : isEdit
                    ? t("saveChanges")
                    : t("create")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
