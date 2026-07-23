"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createUserAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { generateUsernameFromFullName } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OutlinedField,
  OutlinedSelect,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";

export function CreateUserModal({
  open,
  onClose,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tUsers = useTranslations("admin.users");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { roles, gender: genders } = useLabelMaps();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const usernameTouchedRef = useRef(false);
  const { confirm, dialog } = useConfirmDialog();
  const { mounted, active } = useOverlayAnimation(open);

  const handleClose = useCallback(() => {
    setError("");
    setName("");
    setUsername("");
    usernameTouchedRef.current = false;
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

  function handleNameChange(next: string) {
    setName(next);
    if (!usernameTouchedRef.current) {
      setUsername(generateUsernameFromFullName(next));
    }
  }

  function handleUsernameChange(next: string) {
    usernameTouchedRef.current = true;
    setUsername(next.toLowerCase().replace(/[^a-z0-9.]/g, ""));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const displayName = name.trim();
    formData.set("name", displayName);
    formData.set("username", username.trim());

    confirm({
      title: tUsers("confirmCreateTitle"),
      message: tUsers("confirmCreateMessage", { name: displayName }),
      confirmLabel: t("createUser"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        startTransition(async () => {
          const result = await createUserAction(formData);
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
          aria-label={tUsers("closeCreateFormAria")}
          className={cn(
            "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
            active && "is-active",
          )}
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-form-title"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[min(90dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-none border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
            active && "is-active",
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2
                id="create-user-form-title"
                className="text-lg font-semibold text-primary"
              >
                {tUsers("createFormTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tUsers("createFormSubtitle")}
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
            key={formKey}
            id="create-user-form"
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <OutlinedField label={tSettings("name")} htmlFor="create-user-name" className="mt-1">
                <Input
                  id="create-user-name"
                  name="name"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Trần Công Vinh"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("username")} htmlFor="create-user-username">
                <Input
                  id="create-user-username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9]+\.[a-z0-9]+(\.[a-z0-9]+)*"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="vinh.t"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("email")} htmlFor="create-user-email">
                <Input
                  id="create-user-email"
                  name="email"
                  type="email"
                  required
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("phone")} htmlFor="create-user-phone">
                <Input
                  id="create-user-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0901234567"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedField label={tSettings("dateOfBirth")} htmlFor="create-user-dob">
                <Input
                  id="create-user-dob"
                  name="dateOfBirth"
                  type="date"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedSelect
                id="create-user-gender"
                name="gender"
                label={tSettings("gender")}
                defaultValue=""
              >
                <option value="">{tSettings("genderPlaceholder")}</option>
                {Object.entries(genders).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </OutlinedSelect>
              <OutlinedField label={tSettings("newPassword")} htmlFor="create-user-password">
                <Input
                  id="create-user-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={cn(outlinedFieldControlClass, "h-auto")}
                />
              </OutlinedField>
              <OutlinedSelect
                id="create-user-role"
                name="role"
                label={tSettings("role")}
                defaultValue="SUPPORT"
              >
                {Object.entries(roles).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </OutlinedSelect>
              <OutlinedSelect
                id="create-user-department"
                name="departmentId"
                label={tSettings("department")}
                defaultValue=""
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
                  defaultChecked
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
                {isPending ? tCommon("loading") : t("createUser")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
