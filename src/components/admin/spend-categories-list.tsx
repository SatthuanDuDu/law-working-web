"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Search, Trash2, Unlock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  deleteSpendCategoryAction,
  setSpendCategoryActiveAction,
  updateSpendCategoryAction,
} from "@/lib/spend-category-actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Badge, Card, CardContent, CardHeader, CardTitle, Label } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";

export type SpendCategoryListItem = {
  id: string;
  name: string;
  code: string | null;
  requiresMatter: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  txCount: number;
};

type StatusFilter = "all" | "active" | "inactive";

function EditModal({
  item,
  onClose,
}: {
  item: SpendCategoryListItem;
  onClose: () => void;
}) {
  const t = useTranslations("admin.spendCategories");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { mounted, active } = useOverlayAnimation(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const matterLocked = item.isSystem && item.code === "MATTER";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (matterLocked) formData.set("requiresMatter", "on");
    setError("");
    startTransition(async () => {
      const result = await updateSpendCategoryAction(item.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4",
        "transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        className={cn(
          "relative z-10 w-full max-w-md rounded-t-md border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-md",
          active ? "translate-y-0" : "translate-y-4",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("editTitle")}</h2>
          <button type="button" className="interactive-press rounded-md p-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-cat-name">{t("nameLabel")}</Label>
            <Input id="edit-cat-name" name="name" required defaultValue={item.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cat-sort">{t("sortLabel")}</Label>
            <Input
              id="edit-cat-sort"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={item.sortOrder}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="requiresMatter"
              defaultChecked={item.requiresMatter}
              disabled={matterLocked}
              className="rounded"
            />
            {t("requiresMatterLabel")}
            {matterLocked ? (
              <span className="text-xs text-muted-foreground">({t("lockedMatter")})</span>
            ) : null}
          </label>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {tCommon("save")}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function SpendCategoriesList({ items }: { items: SpendCategoryListItem[] }) {
  const t = useTranslations("admin.spendCategories");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editItem, setEditItem] = useState<SpendCategoryListItem | null>(null);
  const [actionError, setActionError] = useState("");

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!normalized) return true;
      return item.name.toLowerCase().includes(normalized);
    });
  }, [items, query, statusFilter]);

  function handleToggleActive(item: SpendCategoryListItem) {
    const nextActive = !item.isActive;
    setActionError("");
    confirm({
      title: nextActive ? t("confirmActivateTitle") : t("confirmDeactivateTitle"),
      message: nextActive
        ? t("confirmActivateMessage", { name: item.name })
        : t("confirmDeactivateMessage", { name: item.name }),
      confirmLabel: nextActive ? t("activate") : t("deactivate"),
      cancelLabel: tCommon("cancel"),
      variant: nextActive ? "default" : "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await setSpendCategoryActiveAction(item.id, nextActive);
          if (result.error) {
            setActionError(result.error);
            return;
          }
          router.refresh();
        });
      },
    });
  }

  function handleDelete(item: SpendCategoryListItem) {
    setActionError("");
    confirm({
      title: t("deleteTitle"),
      message: t("deleteConfirm", { name: item.name }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteSpendCategoryAction(item.id);
          if (result.error) {
            setActionError(result.error);
            return;
          }
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      {editItem ? <EditModal item={editItem} onClose={() => setEditItem(null)} /> : null}
      <Card className="rounded-[5px]">
        <CardHeader className="gap-3 space-y-0 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <CardTitle className="text-base sm:text-lg">{t("listTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("itemCount", { count: visibleItems.length })}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 pl-9"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={(next) => setStatusFilter(next as StatusFilter)}
              className="h-auto sm:w-48"
              options={[
                { value: "all", label: t("allStatuses") },
                { value: "active", label: tAdmin("inUse") },
                { value: "inactive", label: tAdmin("inactiveShort") },
              ]}
            />
          </div>
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        </CardHeader>
        <CardContent className="divide-y divide-border/70 p-0">
          {visibleItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("emptyHint")}
            </p>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.name}</p>
                    {item.isSystem ? (
                      <Badge variant="info">{t("systemBadge")}</Badge>
                    ) : null}
                    {item.requiresMatter ? (
                      <Badge variant="default">{t("matterBadge")}</Badge>
                    ) : null}
                    {!item.isActive ? (
                      <Badge variant="warning">{tAdmin("inactiveShort")}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("txCount", { count: item.txCount })} · {t("sortLabel")}:{" "}
                    {item.sortOrder}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="interactive-press"
                    disabled={isPending}
                    onClick={() => setEditItem(item)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {tCommon("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="interactive-press"
                    disabled={isPending}
                    onClick={() => handleToggleActive(item)}
                  >
                    {item.isActive ? (
                      <Lock className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="mr-1 h-3.5 w-3.5" />
                    )}
                    {item.isActive ? t("deactivate") : t("activate")}
                  </Button>
                  {!item.isSystem ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="interactive-press text-destructive"
                      disabled={isPending || item.txCount > 0}
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {tCommon("delete")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
