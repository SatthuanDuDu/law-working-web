"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createDepartmentAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";

export function DepartmentForm() {
  const router = useRouter();
  const t = useTranslations("admin.departments");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: t("confirmAddTitle"),
      message: t("confirmAddMessage", { name }),
      confirmLabel: t("addButton"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createDepartmentAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(t("added"));
          (document.getElementById("department-form") as HTMLFormElement)?.reset();
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form id="department-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="mt-1 space-y-2">
          <Label htmlFor="name" className="mb-1 block">
            {t("nameLabel")}
          </Label>
          <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? tCommon("saving") : t("addButton")}
        </Button>
      </form>
    </>
  );
}
