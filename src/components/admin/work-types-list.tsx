"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Search, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  deleteWorkTypeAction,
  setWorkTypeActiveAction,
} from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { EditWorkTypeModal } from "@/components/admin/edit-work-type-modal";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type WorkTypeListItem = {
  id: string;
  name: string;
  isActive: boolean;
  planStepCount: number;
};

type StatusFilter = "all" | "active" | "inactive";

export function WorkTypesList({ items }: { items: WorkTypeListItem[] }) {
  const t = useTranslations("admin.workTypes");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editItem, setEditItem] = useState<WorkTypeListItem | null>(null);
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

  function handleToggleActive(item: WorkTypeListItem) {
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
          const result = await setWorkTypeActiveAction(item.id, nextActive);
          if (result.error) {
            setActionError(result.error);
            return;
          }
          router.refresh();
        });
      },
    });
  }

  function handleDelete(item: WorkTypeListItem) {
    setActionError("");
    confirm({
      title: t("deleteTitle"),
      message: t("deleteConfirm", { name: item.name }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteWorkTypeAction(item.id);
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

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-9 sm:w-48"
              aria-label={tCommon("status")}
            >
              <option value="all">{t("allStatuses")}</option>
              <option value="active">{tAdmin("inUse")}</option>
              <option value="inactive">{tAdmin("inactiveShort")}</option>
            </Select>
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
              <div
                key={item.id}
                className={cn(
                  "px-4 py-3 sm:px-6",
                  !item.isActive && "bg-muted/30",
                )}
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {item.name}
                      </h3>
                      <Badge
                        variant={item.isActive ? "success" : "danger"}
                        className="px-2 py-0 text-[10px]"
                      >
                        {item.isActive ? tAdmin("inUse") : tAdmin("inactiveShort")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("planStepUsage", { count: item.planStepCount })}
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
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleActive(item)}
                      className={cn(
                        "h-8 px-2.5",
                        item.isActive
                          ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40"
                          : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40",
                      )}
                      aria-label={
                        item.isActive
                          ? `${t("deactivate")} ${item.name}`
                          : `${t("activate")} ${item.name}`
                      }
                    >
                      {item.isActive ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {item.isActive ? t("deactivateShort") : t("activateShort")}
                      </span>
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
        <EditWorkTypeModal
          open={Boolean(editItem)}
          item={editItem}
          onClose={() => setEditItem(null)}
        />
      ) : null}
    </>
  );
}
