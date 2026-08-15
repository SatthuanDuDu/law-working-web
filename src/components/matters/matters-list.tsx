"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ClipboardList, FileSpreadsheet, Pencil, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { bulkUpdateMatterStatusAction, deleteMatterAction, restoreMatterAction } from "@/lib/actions";
import { useMatterFormData } from "@/hooks/use-matter-form-data";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import type { MatterFilterOptions } from "@/lib/matter-form-data";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { downloadExcel } from "@/lib/export-excel";
import { cn, formatDateTime } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { UndoToast } from "@/components/ui/undo-toast";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import {
  DEFAULT_MATTERS_FILTERS,
  MattersFiltersBar,
  type MattersFilterState,
} from "@/components/matters/matters-filters";
import {
  CreateMatterModal,
  type MatterEditInitial,
} from "@/components/matters/create-matter-modal";
import type { MatterStatus, MatterType } from "@prisma/client";

const BULK_STATUSES: MatterStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "CLOSED",
];
export type MatterListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: MatterType;
  customTypeLabel: string | null;
  status: MatterStatus;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  leadLawyer: { id: string; name: string };
  members: { userId: string; user: { id: string; name: string } }[];
  _count: { tasks: number };
};

function startOfDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function applyMattersFilters(
  matters: MatterListItem[],
  filters: MattersFilterState,
  matterTypeLabels: Record<MatterType, string>,
  locale: string,
) {
  const query = filters.query.trim().toLowerCase();

  const filtered = matters.filter((matter) => {
    if (query) {
      const haystack = [
        matter.code,
        matter.title,
        matter.client.name,
        matter.leadLawyer.name,
        ...matter.members.map((member) => member.user.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(matter.type)) {
      return false;
    }
    if (
      filters.lawyerIds.length > 0 &&
      !filters.lawyerIds.includes(matter.leadLawyer.id)
    ) {
      return false;
    }
    if (filters.memberIds.length > 0) {
      const memberSet = new Set(matter.members.map((member) => member.userId));
      const matched = filters.memberIds.some((id) => memberSet.has(id));
      if (!matched) return false;
    }
    if (filters.clientIds.length > 0 && !filters.clientIds.includes(matter.client.id)) {
      return false;
    }
    if (filters.dateFrom) {
      if (new Date(matter.createdAt) < startOfDay(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      if (new Date(matter.createdAt) > endOfDay(filters.dateTo)) return false;
    }
    return true;
  });

  const direction = filters.sortDir === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let compare = 0;
    switch (filters.sortBy) {
      case "type":
        compare = matterTypeLabels[a.type].localeCompare(
          matterTypeLabels[b.type],
          locale,
        );
        break;
      case "lawyer":
        compare = a.leadLawyer.name.localeCompare(b.leadLawyer.name, locale);
        break;
      case "member": {
        const membersA = a.members
          .map((member) => member.user.name)
          .sort((left, right) => left.localeCompare(right, locale))
          .join(", ");
        const membersB = b.members
          .map((member) => member.user.name)
          .sort((left, right) => left.localeCompare(right, locale))
          .join(", ");
        compare = membersA.localeCompare(membersB, locale);
        break;
      }
      case "client":
        compare = a.client.name.localeCompare(b.client.name, locale);
        break;
      case "createdAt":
      default:
        compare =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return compare * direction;
  });
}

export function MattersList({
  matters,
  totalCount,
  filterOptions,
  canManage,
}: {
  matters: MatterListItem[];
  /** True DB count — may exceed matters.length when the list-limit cap truncated the fetch. */
  totalCount: number;
  filterOptions: MatterFilterOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("matters");
  const tPages = useTranslations("pages.matters");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const { formData, loading: formDataLoading, ensureLoaded } = useMatterFormData();
  const [editMatter, setEditMatter] = useState<MatterEditInitial | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { mode, setMode } = useListViewMode("matters");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<MatterStatus>("IN_PROGRESS");
  const [undoToast, setUndoToast] = useState<{
    key: string;
    matterId: string;
    title: string;
  } | null>(null);

  const clientIdFromUrl = searchParams.get("clientId");
  const [filters, setFilters] = useState<MattersFilterState>(DEFAULT_MATTERS_FILTERS);

  /** Deep-link `?clientId=` seeds the client filter without a syncing effect. */
  const effectiveFilters = useMemo((): MattersFilterState => {
    if (!clientIdFromUrl) return filters;
    return { ...filters, clientIds: [clientIdFromUrl] };
  }, [filters, clientIdFromUrl]);

  function syncClientIdToUrl(nextClientIds: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextClientIds.length === 1) {
      params.set("clientId", nextClientIds[0]);
    } else {
      params.delete("clientId");
    }
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href, { scroll: false });
  }

  function handleFiltersChange(next: MattersFilterState) {
    setFilters(next);
    const prevIds = effectiveFilters.clientIds;
    const prevSingle = prevIds.length === 1 ? prevIds[0] : null;
    const nextSingle = next.clientIds.length === 1 ? next.clientIds[0] : null;
    const clearedOrChanged =
      prevSingle !== nextSingle ||
      (prevIds.length > 0 && next.clientIds.length === 0) ||
      (prevIds.length === 1 && next.clientIds.length !== 1);
    if (clearedOrChanged) {
      syncClientIdToUrl(next.clientIds);
    }
  }

  const visibleMatters = useMemo(
    () => applyMattersFilters(matters, effectiveFilters, labels.matterType, locale),
    [matters, effectiveFilters, labels.matterType, locale],
  );

  const selectableVisibleIds = useMemo(
    () => visibleMatters.map((matter) => matter.id),
    [visibleMatters],
  );

  const activeSelectedIds = useMemo(() => {
    const visibleIdSet = new Set(visibleMatters.map((matter) => matter.id));
    return new Set([...selectedIds].filter((id) => visibleIdSet.has(id)));
  }, [selectedIds, visibleMatters]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = selectableVisibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(selectableVisibleIds);
    });
  }

  function applyBulkStatus() {
    const ids = [...activeSelectedIds];
    if (ids.length === 0) return;
    const statusLabel = labels.matterStatus[bulkStatus];
    confirm({
      title: t("confirmBulkStatusTitle"),
      message: t("confirmBulkStatusMessage", {
        count: ids.length,
        status: statusLabel,
      }),
      confirmLabel: t("updateStatus"),
      onConfirm: () => {
        startTransition(async () => {
          const result = await bulkUpdateMatterStatusAction(ids, bulkStatus);
          if (result.error) {
            confirm({
              title: t("confirmBulkStatusTitle"),
              message: result.error,
              confirmLabel: tCommon("close"),
              onConfirm: () => undefined,
            });
            return;
          }
          setSelectedIds(new Set());
          router.refresh();
        });
      },
    });
  }

  function handleExportExcel() {
    void downloadExcel(
      tPages("title"),
      visibleMatters.map((matter) => ({
        [t("code")]: matter.code,
        [t("title")]: matter.title,
        [t("client")]: matter.client.name,
        [t("leadLawyer")]: matter.leadLawyer.name,
        [t("members")]:
          matter.members.map((member) => member.user.name).join(", ") || "—",
        [t("fieldType")]: getMatterTypeDisplay(matter.type, matter.customTypeLabel),
        [t("status")]: labels.matterStatus[matter.status],
        [t("fieldCreatedAt")]: formatDateTime(matter.createdAt),
        [t("fieldTaskCount")]: matter._count.tasks,
      })),
      "vu-viec",
    );
  }

  async function openEdit(matter: MatterListItem) {
    setEditMatter({
      id: matter.id,
      code: matter.code,
      title: matter.title,
      description: matter.description,
      type: matter.type,
      customTypeLabel: matter.customTypeLabel,
      clientId: matter.client.id,
      clientName: matter.client.name,
      clientPhone: matter.client.phone,
      clientAddress: matter.client.address,
      clientCity: matter.client.city,
      leadLawyerId: matter.leadLawyer.id,
      memberIds: matter.members.map((member) => member.userId),
    });
    const data = await ensureLoaded();
    if (data) setEditOpen(true);
  }

  function handleDelete(matter: MatterListItem) {
    confirm({
      title: t("deleteTitle"),
      message: t("deleteConfirm", { title: matter.title, code: matter.code }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteMatterAction(matter.id);
          if (result.error) {
            confirm({
              title: tCommon("cannotDelete"),
              message: result.error,
              confirmLabel: tCommon("close"),
              onConfirm: () => undefined,
            });
            return;
          }
          setUndoToast({
            key: `${matter.id}-${Date.now()}`,
            matterId: matter.id,
            title: matter.title,
          });
          router.refresh();
        });
      },
    });
  }

  function renderMatterActions(matter: MatterListItem, compact = false) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-2",
          compact ? "sm:w-full" : "sm:w-auto sm:shrink-0 sm:items-stretch",
        )}
      >
        {canManage ? (
          <div className={cn("flex items-center gap-2", !compact && "sm:justify-end")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || formDataLoading}
              onClick={() => void openEdit(matter)}
              aria-label={t("editMatter")}
              className="flex-1 sm:flex-none"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sm:inline">{tCommon("edit")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleDelete(matter)}
              className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 sm:flex-none"
              aria-label={t("deleteMatter")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sm:inline">{tCommon("delete")}</span>
            </Button>
          </div>
        ) : null}
        <Button asChild size="sm" className="w-full">
          <Link href={`/matters/${matter.id}/plan`}>
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="sm:hidden">{t("setupPlan")}</span>
            <span className="hidden sm:inline">{t("setupPlanLong")}</span>
          </Link>
        </Button>
      </div>
    );
  }

  function renderListCard(matter: MatterListItem) {
    return (
      <Card key={matter.id} solid className="rounded-md border-border/50">
        <CardHeader className="flex flex-col gap-2 space-y-0 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={activeSelectedIds.has(matter.id)}
                onChange={() => toggleSelected(matter.id)}
                aria-label={matter.title}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
              />
              <CardTitle className="min-w-0 text-lg leading-snug">
                <Link
                  href={`/matters/${matter.id}`}
                  className="interactive-link hover:text-primary"
                >
                  {matter.title}
                </Link>
              </CardTitle>
              <MatterStatusBadge status={matter.status} />
            </div>
            <p className="break-all font-mono text-xs font-medium tabular-nums tracking-tight text-primary sm:break-normal">
              {matter.code}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {matter.client.name}
            </p>
          </div>
          {renderMatterActions(matter)}
        </CardHeader>

        <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("fieldType")}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">
                {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("leadLawyer")}
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                {matter.leadLawyer.name}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("members")}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">
                {matter.members.map((member) => member.user.name).join(", ") || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("fieldCreatedAt")}
              </dt>
              <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">
                {formatDateTime(matter.createdAt)}
              </dd>
            </div>
          </dl>
          <p className="border-t border-border/70 pt-3 text-sm font-medium text-primary">
            {t("taskCount", { count: matter._count.tasks })}
          </p>
        </CardContent>
      </Card>
    );
  }

  function renderGridCard(matter: MatterListItem) {
    return (
      <Card key={matter.id} solid className="flex flex-col rounded-md border-border/50">
        <CardHeader className="space-y-1.5 p-3 pb-2">
          <div className="flex flex-wrap items-start gap-2">
            <input
              type="checkbox"
              checked={activeSelectedIds.has(matter.id)}
              onChange={() => toggleSelected(matter.id)}
              aria-label={matter.title}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
            />
            <CardTitle className="min-w-0 flex-1 text-base leading-snug">
              <Link
                href={`/matters/${matter.id}`}
                className="interactive-link hover:text-primary"
              >
                {matter.title}
              </Link>
            </CardTitle>
            <MatterStatusBadge status={matter.status} />
          </div>
          <p className="break-all font-mono text-[11px] font-medium tabular-nums tracking-tight text-primary">
            {matter.code}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {matter.client.name}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-3 pt-0">
          <dl className="grid gap-1.5 text-sm">
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("leadLawyer")}
              </dt>
              <dd className="mt-0.5 truncate font-medium text-foreground">
                {matter.leadLawyer.name}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("fieldType")}
              </dt>
              <dd className="mt-0.5 truncate font-medium text-foreground">
                {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
              </dd>
            </div>
          </dl>
          <p className="text-sm font-medium text-primary">
            {t("taskCount", { count: matter._count.tasks })}
          </p>
          {renderMatterActions(matter, true)}
        </CardContent>
      </Card>
    );
  }

  function renderTableView() {
    return (
      <Card solid className="overflow-hidden rounded-md border-border/50 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-3 py-2.5 font-medium">
                  {selectableVisibleIds.length > 0 ? (
                    <input
                      type="checkbox"
                      checked={selectableVisibleIds.every((id) =>
                        activeSelectedIds.has(id),
                      )}
                      onChange={toggleSelectAllVisible}
                      aria-label={tCommon("selectAll")}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  ) : null}
                </th>
                <th className="px-3 py-2.5 font-medium">{t("fieldType")}</th>
                <th className="px-3 py-2.5 font-medium">{t("title")}</th>
                <th className="px-3 py-2.5 font-medium">{t("client")}</th>
                <th className="px-3 py-2.5 font-medium">{t("leadLawyer")}</th>
                <th className="px-3 py-2.5 font-medium">{t("status")}</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("fieldCreatedAt")}
                </th>
                {canManage ? (
                  <th className="px-3 py-2.5 text-right font-medium">
                    <span className="sr-only">{tCommon("actions")}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visibleMatters.map((matter) => (
                <tr key={matter.id} className="interactive-row">
                  <td className="w-8 px-3 py-2.5 align-top">
                    <input
                      type="checkbox"
                      checked={activeSelectedIds.has(matter.id)}
                      onChange={() => toggleSelected(matter.id)}
                      aria-label={matter.title}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </td>
                  <td className="max-w-[9rem] truncate px-3 py-2.5 align-top text-foreground">
                    {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
                  </td>
                  <td className="min-w-[14rem] px-3 py-2.5 align-top">
                    <Link
                      href={`/matters/${matter.id}`}
                      className="interactive-link block truncate font-medium text-foreground hover:text-primary"
                    >
                      {matter.title}
                    </Link>
                    <p className="truncate font-mono text-[11px] text-primary/80">
                      {matter.code}
                    </p>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2.5 align-top text-foreground">
                    {matter.client.name}
                  </td>
                  <td className="max-w-[9rem] truncate px-3 py-2.5 align-top text-foreground">
                    {matter.leadLawyer.name}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <MatterStatusBadge status={matter.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-muted-foreground">
                    {formatDateTime(matter.createdAt)}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2.5 text-right align-top">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isPending || formDataLoading}
                          onClick={() => void openEdit(matter)}
                          aria-label={t("editMatter")}
                          title={t("editMatter")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                          disabled={isPending}
                          onClick={() => handleDelete(matter)}
                          aria-label={t("deleteMatter")}
                          title={t("deleteMatter")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <>
      {dialog}
      <div className="space-y-4">
        <div className="shrink-0 border-b border-border/60 pb-3">
          <PageToolbar
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={visibleMatters.length === 0}
                  onClick={handleExportExcel}
                  aria-label={tCommon("exportExcel")}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
                </Button>
                <ListViewToggle mode={mode} onChange={setMode} size="sm" />
              </>
            }
          >
            <MattersFiltersBar
              filters={effectiveFilters}
              onChange={handleFiltersChange}
              typeOptions={Object.keys(labels.matterType) as MatterType[]}
              lawyers={filterOptions.lawyers}
              members={filterOptions.members}
              clients={filterOptions.clients}
              className="min-w-0 flex-1 basis-full sm:basis-0"
            />
          </PageToolbar>
        </div>

        {totalCount > matters.length ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t("listTruncatedWarning", {
                shown: matters.length,
                total: totalCount,
              })}
            </p>
          </div>
        ) : null}

        {activeSelectedIds.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary-muted/50 px-3 py-2 backdrop-blur-sm">
            <span className="text-sm font-medium text-primary">
              {t("selectedCount", { count: activeSelectedIds.size })}
            </span>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as MatterStatus)}
              className="h-8 w-auto min-w-0 text-xs"
            >
              {BULK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {labels.matterStatus[status]}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={applyBulkStatus}
            >
              {t("applyBulkStatus")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto"
            >
              <X className="h-3.5 w-3.5" />
              {tCommon("clearSelection")}
            </Button>
          </div>
        ) : null}

        {matters.length === 0 ? (
          <Card solid>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("emptyHint")}
            </CardContent>
          </Card>
        ) : visibleMatters.length === 0 ? (
          <Card solid>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("noFilterMatch")}
            </CardContent>
          </Card>
        ) : mode === "table" ? (
          <>
            <div className="hidden sm:block">{renderTableView()}</div>
            <div className="space-y-2 sm:hidden">
              {visibleMatters.map((matter) => renderListCard(matter))}
            </div>
          </>
        ) : mode === "grid" ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMatters.map((matter) => renderGridCard(matter))}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleMatters.map((matter) => renderListCard(matter))}
          </div>
        )}
      </div>

      {editOpen && formData ? (
        <CreateMatterModal
          open={editOpen}
          formData={formData}
          editMatter={editMatter}
          onClose={() => {
            setEditOpen(false);
            setEditMatter(null);
          }}
        />
      ) : null}
      {undoToast ? (
        <UndoToast
          toastKey={undoToast.key}
          message={t("deletedToast", { title: undoToast.title })}
          undoLabel={tCommon("undo")}
          onUndo={async () => {
            const result = await restoreMatterAction(undoToast.matterId);
            if (result.error) {
              confirm({
                title: tCommon("cannotDelete"),
                message: result.error,
                confirmLabel: tCommon("close"),
                onConfirm: () => undefined,
              });
              return;
            }
            router.refresh();
          }}
          onDismiss={() => setUndoToast(null)}
        />
      ) : null}
    </>
  );
}
