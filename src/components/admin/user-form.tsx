"use client";

import { useState, useTransition, type FormEvent } from "react";
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

export function UserForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const t = useTranslations("admin");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { roles } = useLabelMaps();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: tCommon("confirm"),
      message: `${t("createUser")}: "${name}"?`,
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
          (document.getElementById("user-form") as HTMLFormElement)?.reset();
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
