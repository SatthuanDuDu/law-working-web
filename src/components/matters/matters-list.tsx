"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ClipboardList, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { deleteMatterAction, restoreMatterAction } from "@/lib/actions";
import { useMatterFormData } from "@/hooks/use-matter-form-data";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import type { MatterFilterOptions } from "@/lib/matter-form-data";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { downloadExcel } from "@/lib/export-excel";
import { cn, formatDateTime } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
import { UndoToast } from "@/components/ui/undo-toast";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import {
  DEFAULT_MATTERS_FILTERS,
  MattersFiltersBar,
  type MattersFilterState,
} from "@/components/matters/matters-filters";
import { CreateMatterButton } from "@/components/matters/create-matter-button";
import {
  CreateMatterModal,
  type MatterEditInitial,
} from "@/components/matters/create-matter-modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  nexusAvatarTone,
  nexusGridCardClass,
  nexusGridClass,
  nexusInitials,
} from "@/lib/list-surface";
import type { MatterStatus, MatterType } from "@prisma/client";

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
              className={cn("flex-1 sm:flex-none", compact && "h-8 rounded-full px-2.5")}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className={cn(compact && "sr-only")}>{tCommon("edit")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleDelete(matter)}
              className={cn(
                "flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 sm:flex-none",
                compact && "h-8 rounded-full px-2.5",
              )}
              aria-label={t("deleteMatter")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className={cn(compact && "sr-only")}>{tCommon("delete")}</span>
            </Button>
          </div>
        ) : null}
        <Button asChild size="sm" className={cn("w-full", compact && "rounded-full")}>
          <Link href={compact ? `/matters/${matter.id}` : `/matters/${matter.id}/plan`}>
            <ClipboardList className="h-3.5 w-3.5" />
            {compact ? (
              <span>{t("viewHub")}</span>
            ) : (
              <>
                <span className="sm:hidden">{t("setupPlan")}</span>
                <span className="hidden sm:inline">{t("setupPlanLong")}</span>
              </>
            )}
          </Link>
        </Button>
      </div>
    );
  }

  function renderListCard(matter: MatterListItem) {
    return (
      <Card key={matter.id} solid className="rounded-xl border-border/50">
        <CardHeader className="flex flex-col gap-2 space-y-0 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
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
    const clientLine = [matter.client.city, matter.client.address]
      .filter(Boolean)
      .join(" • ");
    const memberNames = matter.members.map((m) => m.user.name).filter(Boolean);

    return (
      <article key={matter.id} className={nexusGridCardClass}>
        <div className="min-w-0">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm",
                  nexusAvatarTone(matter.id),
                )}
              >
                {nexusInitials(matter.client.name)}
              </div>
              <div className="min-w-0">
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  {matter.code}
                </span>
                <div className="mt-0.5">
                  <MatterStatusBadge status={matter.status} />
                </div>
              </div>
            </div>
          </div>

          <h3 className="line-clamp-2 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            <Link href={`/matters/${matter.id}`} className="hover:underline">
              {matter.title}
            </Link>
          </h3>
          <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
            {matter.client.name}
          </p>
          {clientLine ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {clientLine}
            </p>
          ) : null}

          <div className="mt-3.5 space-y-1.5 rounded-xl bg-surface-container px-3 py-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("leadLawyer")}</span>
              <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {nexusInitials(matter.leadLawyer.name)}
                </span>
                <span className="truncate">{matter.leadLawyer.name}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("fieldType")}</span>
              <span className="truncate font-medium text-foreground">
                {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t("tasksLabel")}</span>
              <span className="font-semibold tabular-nums text-primary">
                {matter._count.tasks}
              </span>
            </div>
          </div>

          {memberNames.length > 0 ? (
            <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">
              {t("members")}: {memberNames.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-3 border-t border-border/60 pt-3.5">
          <p className="text-[11px] text-muted-foreground">
            {t("fieldUpdatedAt")}: {formatDateTime(matter.updatedAt)}
          </p>
          {renderMatterActions(matter, true)}
        </div>
      </article>
    );
  }

  function renderTableView() {
    return (
      <Card solid className="overflow-hidden rounded-2xl border-border/50 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-container-low text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="min-w-[16rem] px-4 py-3.5 font-medium">
                  {t("code")} · {t("title")}
                </th>
                <th className="min-w-[12rem] px-4 py-3.5 font-medium">{t("client")}</th>
                <th className="min-w-[10rem] px-4 py-3.5 font-medium">{t("leadLawyer")}</th>
                <th className="min-w-[8rem] px-4 py-3.5 font-medium">{t("status")}</th>
                <th className="min-w-[8rem] px-4 py-3.5 font-medium">{t("fieldUpdatedAt")}</th>
                {canManage ? (
                  <th className="px-4 py-3.5 text-right font-medium">
                    <span className="sr-only">{tCommon("actions")}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {visibleMatters.map((matter) => {
                const team = [
                  matter.leadLawyer,
                  ...matter.members
                    .map((m) => m.user)
                    .filter((u) => u.id !== matter.leadLawyer.id),
                ].slice(0, 3);
                const extraMembers = Math.max(
                  0,
                  1 + matter.members.length - team.length,
                );

                return (
                  <tr
                    key={matter.id}
                    className="group transition-colors hover:bg-surface-container-low/70"
                  >
                    <td className="min-w-[16rem] px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-foreground">
                            {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {matter.code}
                          </span>
                        </div>
                        <Link
                          href={`/matters/${matter.id}`}
                          className="interactive-link line-clamp-2 font-semibold text-foreground hover:text-primary"
                        >
                          {matter.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t("taskCount", { count: matter._count.tasks })}
                        </p>
                      </div>
                    </td>
                    <td className="min-w-[12rem] px-4 py-4 align-top">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-muted text-[11px] font-bold text-primary">
                          {nexusInitials(matter.client.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {matter.client.name}
                          </p>
                          {matter.client.city ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {matter.client.city}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[10rem] px-4 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {team.map((person) => (
                            <UserAvatar
                              key={person.id}
                              userId={person.id}
                              name={person.name}
                              size="sm"
                              className="h-8 w-8 ring-2 ring-surface"
                            />
                          ))}
                        </div>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {matter.leadLawyer.name}
                          {extraMembers > 0 ? ` +${extraMembers}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <MatterStatusBadge status={matter.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(matter.updatedAt)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-4 text-right align-top">
                        <div className="flex justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
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
                            className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
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
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 bg-surface-container-low px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {visibleMatters.length === matters.length
              ? t("matterCount", { count: totalCount })
              : t("matterCountFiltered", {
                  visible: visibleMatters.length,
                  total: totalCount,
                })}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <>
      {dialog}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {tPages("title")}
              </h1>
              <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-primary">
                {t("matterCount", { count: totalCount })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{tPages("description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListViewToggle
              mode={mode}
              onChange={setMode}
              size="sm"
              className="rounded-full border-0 bg-surface-container p-1 shadow-inner"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={visibleMatters.length === 0}
              onClick={handleExportExcel}
              aria-label={tCommon("exportExcel")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
            </Button>
            <CreateMatterButton variant="toolbar" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface p-3 shadow-[var(--shadow-card)] sm:p-4">
          <MattersFiltersBar
            filters={effectiveFilters}
            onChange={handleFiltersChange}
            typeOptions={Object.keys(labels.matterType) as MatterType[]}
            lawyers={filterOptions.lawyers}
            members={filterOptions.members}
            clients={filterOptions.clients}
          />
        </div>

        {totalCount > matters.length ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t("listTruncatedWarning", {
                shown: matters.length,
                total: totalCount,
              })}
            </p>
          </div>
        ) : null}

        {matters.length === 0 ? (
          <Card solid className="rounded-2xl">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("emptyHint")}
            </CardContent>
          </Card>
        ) : visibleMatters.length === 0 ? (
          <Card solid className="rounded-2xl">
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
          <div className={nexusGridClass}>
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
