"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateUserAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OutlinedField,
  OutlinedSelect,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";
import type { Gender, Role } from "@prisma/client";
import { formatDateOfBirthInput } from "@/lib/validations";

export type EditUserInitial = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  role: Role;
  isActive: boolean;
  department: { id: string; name: string } | null;
};

export function EditUserModal({
  open,
  onClose,
  user,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  user: EditUserInitial;
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tUsers = useTranslations("admin.users");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { roles, gender: genders } = useLabelMaps();
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
      title: tUsers("confirmUpdateTitle"),
      message: tUsers("confirmUpdateMessage", { name }),
      confirmLabel: tUsers("saveChanges"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        startTransition(async () => {
          const result = await updateUserAction(user.id, formData);
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
          aria-label={tUsers("closeFormAria")}
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-form-title"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[min(90dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2
                id="edit-user-form-title"
                className="text-lg font-semibold text-primary"
              >
                {tUsers("editFormTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tUsers("editFormSubtitle")}
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
            key={`${user.id}-${formKey}`}
            id="edit-user-form"
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label={tSettings("name")} htmlFor="edit-user-name" className="mt-1">
                <Input
                  id="edit-user-name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={user.name}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("username")} htmlFor="edit-user-username">
                <Input
                  id="edit-user-username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9]+(\.[a-z0-9]+)*"
                  defaultValue={user.username}
                  placeholder="vinh.t"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("email")} htmlFor="edit-user-email">
                <Input
                  id="edit-user-email"
                  name="email"
                  type="email"
                  required
                  defaultValue={user.email}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("phone")} htmlFor="edit-user-phone">
                <Input
                  id="edit-user-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={user.phone ?? ""}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("dateOfBirth")} htmlFor="edit-user-dob">
                <Input
                  id="edit-user-dob"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={formatDateOfBirthInput(user.dateOfBirth)}
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedSelect
                id="edit-user-gender"
                name="gender"
                label={tSettings("gender")}
                defaultValue={user.gender ?? ""}
              >
                <option value="">{tSettings("genderPlaceholder")}</option>
                {Object.entries(genders).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </OutlinedSelect>
              <OutlinedSelect
                id="edit-user-role"
                name="role"
                label={tSettings("role")}
                defaultValue={user.role as Role}
              >
                {Object.entries(roles).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </OutlinedSelect>
              <OutlinedSelect
                id="edit-user-department"
                name="departmentId"
                label={tSettings("department")}
                defaultValue={user.department?.id ?? ""}
              >
                <option value="">—</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </OutlinedSelect>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={user.isActive}
                  className="rounded"
                />
                {t("active")}
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : tUsers("saveChanges")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
