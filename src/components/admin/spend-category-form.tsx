"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSpendCategoryAction } from "@/lib/spend-category-actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/card";

export function SpendCategoryForm() {
  const router = useRouter();
  const t = useTranslations("admin.spendCategories");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");

    confirm({
      title: t("confirmAddTitle"),
      message: t("confirmAddMessage", { name }),
      confirmLabel: t("addButtonShort"),
      cancelLabel: tCommon("cancel"),
      onConfirm: () => {
        setError("");
        setSuccess("");
        startTransition(async () => {
          const result = await createSpendCategoryAction(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccess(t("added"));
          form.reset();
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="spend-cat-name">{t("nameLabel")}</Label>
          <Input
            id="spend-cat-name"
            name="name"
            required
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spend-cat-sort">{t("sortLabel")}</Label>
          <Input
            id="spend-cat-sort"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={100}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiresMatter" className="rounded" />
          {t("requiresMatterLabel")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="rounded"
          />
          {t("activeLabel")}
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : t("addButton")}
        </Button>
      </form>
    </>
  );
}
