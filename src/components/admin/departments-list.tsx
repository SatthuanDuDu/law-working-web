"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteDepartmentAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { EditDepartmentModal } from "@/components/admin/edit-department-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DepartmentListItem = {
  id: string;
  name: string;
  userCount: number;
};

export function DepartmentsList({ items }: { items: DepartmentListItem[] }) {
  const t = useTranslations("admin.departments");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [editItem, setEditItem] = useState<DepartmentListItem | null>(null);
  const [actionError, setActionError] = useState("");

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [items, query]);

  function handleDelete(item: DepartmentListItem) {
    setActionError("");
    confirm({
      title: t("deleteTitle"),
      message: t("deleteConfirm", { name: item.name }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteDepartmentAction(item.id);
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
      <Card className="rounded-[5px]">
        <CardHeader className="gap-3 space-y-0 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <CardTitle className="text-base sm:text-lg">{t("listTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {visibleItems.length === items.length
                ? t("itemCount", { count: items.length })
                : t("itemCountFiltered", {
                    visible: visibleItems.length,
                    total: items.length,
                  })}
            </p>
          </div>

          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 pl-9"
              aria-label={t("searchLabel")}
            />
          </div>
          {actionError ? (
            <p className="text-sm text-red-600">{actionError}</p>
          ) : null}
        </CardHeader>

        <CardContent className="divide-y divide-border/70 p-0">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {t("emptyHint")}
            </p>
          ) : visibleItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {t("noFilterMatch")}
            </p>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className="px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("staffCount", { count: item.userCount })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setEditItem(item)}
                      className="h-8 px-2.5"
                      aria-label={t("editItem")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tCommon("edit")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(item)}
                      className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`${tCommon("delete")} ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {editItem ? (
        <EditDepartmentModal
          open={Boolean(editItem)}
          item={editItem}
          onClose={() => setEditItem(null)}
        />
      ) : null}
    </>
  );
}
