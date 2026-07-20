"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { createUserAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OutlinedField,
  OutlinedSelect,
  outlinedFieldControlClass,
} from "@/components/ui/outlined-field";
import { cn } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useTranslations } from "next-intl";
import { generateUsernameFromFullName } from "@/lib/username";

export function UserForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isPending, startTransition] = useTransition();
  const usernameTouchedRef = useRef(false);
  const { confirm, dialog } = useConfirmDialog();
  const t = useTranslations("admin");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { roles, gender: genders } = useLabelMaps();

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

  function resetFormFields() {
    setName("");
    setUsername("");
    usernameTouchedRef.current = false;
    (document.getElementById("user-form") as HTMLFormElement | null)?.reset();
    // Keep controlled fields in sync after native reset
    setName("");
    setUsername("");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("name", name.trim());
    formData.set("username", username.trim());
    const displayName = name.trim();

    confirm({
      title: tCommon("confirm"),
      message: `${t("createUser")}: "${displayName}"?`,
      confirmLabel: t("createUser"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createUserAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(t("createUser"));
          resetFormFields();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
        <OutlinedField label={tSettings("name")} htmlFor="name" className="mt-1">
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Trần Công Vinh"
            className={cn(outlinedFieldControlClass, "h-auto")}
          />
        </OutlinedField>
        <OutlinedField label={tSettings("username")} htmlFor="username">
          <Input
            id="username"
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
        <OutlinedField label={tSettings("email")} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            className={cn(outlinedFieldControlClass, "h-auto")}
          />
        </OutlinedField>
        <OutlinedField label={tSettings("phone")} htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0901234567"
            className={cn(outlinedFieldControlClass, "h-auto")}
          />
        </OutlinedField>
        <OutlinedField label={tSettings("dateOfBirth")} htmlFor="dateOfBirth">
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            className={cn(outlinedFieldControlClass, "h-auto")}
          />
        </OutlinedField>
        <OutlinedSelect id="gender" name="gender" label={tSettings("gender")} defaultValue="">
          <option value="">{tSettings("genderPlaceholder")}</option>
          {Object.entries(genders).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </OutlinedSelect>
        <OutlinedField label={tSettings("newPassword")} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className={cn(outlinedFieldControlClass, "h-auto")}
          />
        </OutlinedField>
        <OutlinedSelect id="role" name="role" label={tSettings("role")} defaultValue="SUPPORT">
          {Object.entries(roles).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </OutlinedSelect>
        <OutlinedSelect id="departmentId" name="departmentId" label={tSettings("department")}>
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </OutlinedSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked className="rounded" />
          {t("active")}
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? tCommon("loading") : t("createUser")}
        </Button>
      </form>
    </>
  );
}
