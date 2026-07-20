"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { deleteMatterAction } from "@/lib/actions";
import { useMatterFormData } from "@/hooks/use-matter-form-data";
import type { MatterFilterOptions } from "@/lib/matter-form-data";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { formatDateTime } from "@/lib/utils";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const filtered = matters.filter((matter) => {
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
  filterOptions,
  canManage,
}: {
  matters: MatterListItem[];
  filterOptions: MatterFilterOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("matters");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const { formData, loading: formDataLoading, ensureLoaded } = useMatterFormData();
  const [editMatter, setEditMatter] = useState<MatterEditInitial | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [filters, setFilters] = useState<MattersFilterState>(DEFAULT_MATTERS_FILTERS);

  const visibleMatters = useMemo(
    () => applyMattersFilters(matters, filters, labels.matterType, locale),
    [matters, filters, labels.matterType, locale],
  );

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
          router.refresh();
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <div className="space-y-4">
        <MattersFiltersBar
          filters={filters}
          onChange={setFilters}
          typeOptions={Object.keys(labels.matterType) as MatterType[]}
          lawyers={filterOptions.lawyers}
          members={filterOptions.members}
          clients={filterOptions.clients}
        />

        {matters.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("emptyHint")}
            </CardContent>
          </Card>
        ) : visibleMatters.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("noFilterMatch")}
            </CardContent>
          </Card>
        ) : (
          visibleMatters.map((matter) => (
            <Card key={matter.id} className="rounded-[5px]">
              <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
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

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-stretch">
                  {canManage ? (
                    <div className="flex items-center gap-2 sm:justify-end">
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
              </CardHeader>

              <CardContent className="space-y-4 pt-3">
                <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      {matter.members.map((member) => member.user.name).join(", ") ||
                        "—"}
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
          ))
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
    </>
  );
}
