"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  FileSpreadsheet,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteClientAction,
  restoreClientAction,
} from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import { CreateClientButton } from "@/components/clients/create-client-button";
import {
  ClientFormModal,
  type ClientFormInitial,
} from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { UndoToast } from "@/components/ui/undo-toast";
import { useLabelMaps } from "@/i18n/use-label-maps";
import {
  nexusAvatarTone,
  nexusGridCardClass,
  nexusGridClass,
  nexusInitials,
} from "@/lib/list-surface";
import { downloadExcel } from "@/lib/export-excel";
import { cn, formatDateTime } from "@/lib/utils";
import type { ClientBusinessType, MatterStatus } from "@prisma/client";

export type ClientListItem = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  businessType: ClientBusinessType | null;
  notes: string | null;
  updatedAt: string;
  _count: { matters: number };
  openMatters: { id: string; title: string; status: MatterStatus }[];
  leadLawyers: { id: string; name: string }[];
};

type ClientsSortBy = "name" | "city" | "businessType" | "matters";

type ClientsFilterState = {
  query: string;
  names: string[];
  cities: string[];
  businessTypes: ClientBusinessType[];
  sortBy: ClientsSortBy;
  sortDir: "asc" | "desc";
};

const DEFAULT_FILTERS: ClientsFilterState = {
  query: "",
  names: [],
  cities: [],
  businessTypes: [],
  sortBy: "name",
  sortDir: "asc",
};

function toggleSort(
  filters: ClientsFilterState,
  sortBy: ClientsSortBy,
): ClientsFilterState {
  if (filters.sortBy === sortBy) {
    return {
      ...filters,
      sortDir: filters.sortDir === "asc" ? "desc" : "asc",
    };
  }
  return { ...filters, sortBy, sortDir: "asc" };
}

function applyClientFilters(
  clients: ClientListItem[],
  filters: ClientsFilterState,
  businessTypeLabels: Record<ClientBusinessType, string>,
  locale: string,
) {
  const query = filters.query.trim().toLowerCase();

  const filtered = clients.filter((client) => {
    if (query) {
      const haystack = [
        client.code,
        client.name,
        client.email,
        client.phone,
        client.address,
        client.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.names.length > 0 && !filters.names.includes(client.name)) {
      return false;
    }
    if (filters.cities.length > 0) {
      if (!client.city || !filters.cities.includes(client.city)) return false;
    }
    if (filters.businessTypes.length > 0) {
      if (
        !client.businessType ||
        !filters.businessTypes.includes(client.businessType)
      ) {
        return false;
      }
    }
    return true;
  });

  const direction = filters.sortDir === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let compare = 0;
    switch (filters.sortBy) {
      case "city":
        compare = (a.city ?? "").localeCompare(b.city ?? "", locale);
        break;
      case "businessType": {
        const labelA = a.businessType
          ? businessTypeLabels[a.businessType]
          : "";
        const labelB = b.businessType
          ? businessTypeLabels[b.businessType]
          : "";
        compare = labelA.localeCompare(labelB, locale);
        break;
      }
      case "matters":
        compare = a._count.matters - b._count.matters;
        break;
      case "name":
      default:
        compare = a.name.localeCompare(b.name, locale);
        break;
    }
    return compare * direction;
  });
}

export function ClientsList({
  clients,
  canManage,
}: {
  clients: ClientListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("clients");
  const tPages = useTranslations("pages.clients");
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const labels = useLabelMaps();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ClientsFilterState>(DEFAULT_FILTERS);
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientFormInitial | null>(null);
  const { mode, setMode } = useListViewMode("clients");
  const [undoToast, setUndoToast] = useState<{
    key: string;
    clientId: string;
    name: string;
  } | null>(null);

  function openEdit(client: ClientListItem) {
    setEditClient({
      id: client.id,
      code: client.code,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      businessType: client.businessType,
      notes: client.notes,
    });
    setEditOpen(true);
  }

  function handleDelete(client: ClientListItem) {
    confirm({
      title: t("deleteTitle"),
      message: t("deleteConfirm", { name: client.name }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await deleteClientAction(client.id);
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
            key: `${client.id}-${Date.now()}`,
            clientId: client.id,
            name: client.name,
          });
          router.refresh();
        });
      },
    });
  }

  const nameOptions = useMemo(
    () =>
      [...new Set(clients.map((client) => client.name))]
        .sort((a, b) => a.localeCompare(b, locale))
        .map((name) => ({ value: name, label: name })),
    [clients, locale],
  );

  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          clients.map((client) => client.city).filter(Boolean) as string[],
        ),
      ]
        .sort((a, b) => a.localeCompare(b, locale))
        .map((city) => ({ value: city, label: city })),
    [clients, locale],
  );

  const businessTypeOptions = useMemo(
    () =>
      (Object.keys(labels.clientBusinessType) as ClientBusinessType[]).map(
        (type) => ({
          value: type,
          label: labels.clientBusinessType[type],
        }),
      ),
    [labels.clientBusinessType],
  );

  const visibleClients = useMemo(
    () =>
      applyClientFilters(clients, filters, labels.clientBusinessType, locale),
    [clients, filters, labels.clientBusinessType, locale],
  );

  function handleExportExcel() {
    void downloadExcel(
      tPages("title"),
      visibleClients.map((client) => ({
        [t("code")]: client.code,
        [t("name")]: client.name,
        [t("email")]: client.email ?? "",
        [t("phone")]: client.phone ?? "",
        [t("address")]: client.address ?? "",
        [t("city")]: client.city ?? "",
        [t("businessType")]: client.businessType
          ? labels.clientBusinessType[client.businessType]
          : "",
        [t("notes")]: client.notes ?? "",
        [t("mattersMetricLabel")]: client._count.matters,
      })),
      "khach-hang",
    );
  }

  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.names.length > 0 ||
    filters.cities.length > 0 ||
    filters.businessTypes.length > 0;

  function MatterSnapshot({ client }: { client: ClientListItem }) {
    const openCount = client.openMatters.length;
    const total = client._count.matters;
    const preview = client.openMatters.map((m) => m.title).join(" • ");

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{t("cardOpenMatters")}</span>
          {total > 0 ? (
            <Link
              href={`/matters?clientId=${encodeURIComponent(client.id)}`}
              className="interactive-press font-semibold text-primary hover:underline"
            >
              {openCount > 0
                ? t("cardOpenMattersCount", { count: openCount })
                : t("fieldMatters", { count: total })}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">
              {t("noRelatedMatters")}
            </span>
          )}
        </div>
        {preview ? (
          <p className="line-clamp-2 rounded-lg bg-surface-container px-2.5 py-1.5 text-[11px] text-foreground/90">
            {preview}
          </p>
        ) : null}
        {client.leadLawyers.length > 0 ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {t("cardLeadLawyers")}
            </span>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {client.leadLawyers.slice(0, 2).map((lawyer) => (
                <span
                  key={lawyer.id}
                  className="inline-flex max-w-full items-center gap-1.5 font-medium text-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {nexusInitials(lawyer.name)}
                  </span>
                  <span className="truncate">{lawyer.name}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function ClientCard({ client }: { client: ClientListItem }) {
    const industryLine = [
      client.businessType
        ? labels.clientBusinessType[client.businessType]
        : null,
      client.city,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <article
        className={nexusGridCardClass}
      >
        <div className="min-w-0">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm",
                  nexusAvatarTone(client.id),
                )}
              >
                {nexusInitials(client.name)}
              </div>
              <div className="min-w-0">
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  {client.code}
                </span>
                {client.businessType ? (
                  <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-primary-muted px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {labels.clientBusinessType[client.businessType]}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <h3 className="line-clamp-1 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {client.name}
          </h3>
          {industryLine ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{industryLine}</span>
            </div>
          ) : null}
          {client.address ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{client.address}</span>
            </div>
          ) : null}

          {(client.phone || client.email) && (
            <div className="mt-3.5 space-y-1 rounded-xl bg-surface-container px-3 py-2.5 text-xs">
              {client.phone ? (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </a>
              ) : null}
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </a>
              ) : null}
            </div>
          )}

          <div className="mt-3.5">
            <MatterSnapshot client={client} />
          </div>
          {client.notes ? (
            <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
              {client.notes}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3.5">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {t("cardUpdated", { date: formatDateTime(client.updatedAt) })}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {client.phone ? (
              <a
                href={`tel:${client.phone}`}
                className="interactive-press flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-foreground hover:bg-surface-container-high"
                title={t("phone")}
                aria-label={t("phone")}
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="interactive-press flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-foreground hover:bg-surface-container-high"
                title={t("email")}
                aria-label={t("email")}
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {canManage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => openEdit(client)}
                  className="h-7 rounded-full px-2.5"
                  aria-label={t("editClient")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(client)}
                  className="h-7 rounded-full px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                  aria-label={`${tCommon("delete")} ${client.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
            {client._count.matters > 0 ? (
              <Link
                href={`/matters?clientId=${encodeURIComponent(client.id)}`}
                className="interactive-press inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                {t("viewProfile")}
              </Link>
            ) : canManage ? null : (
              <span className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t("noRelatedMatters")}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      {dialog}
      <div className="flex min-h-0 min-w-0 flex-col gap-5">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {tPages("title")}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-muted px-3 py-0.5 text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {t("activeBadge", { count: clients.length })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{tPages("description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ListViewToggle
              mode={mode}
              onChange={setMode}
              size="sm"
              showTable={false}
              className="rounded-full border-0 bg-surface-container p-1 shadow-inner"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={visibleClients.length === 0}
              onClick={handleExportExcel}
              aria-label={tCommon("exportExcel")}
              className="rounded-full"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
            </Button>
            <CreateClientButton />
          </div>
        </section>

        <section className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={filters.query}
              onChange={(event) =>
                setFilters({ ...filters, query: event.target.value })
              }
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-11 rounded-xl border-0 bg-surface-container pl-10 shadow-none focus-visible:ring-primary/30"
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="min-w-[9.5rem] flex-1">
              <MultiSelectFilter
                label={t("filterName")}
                emptyLabel={tCommon("all")}
                values={filters.names}
                onChange={(names) => setFilters({ ...filters, names })}
                options={nameOptions}
                sortActive={filters.sortBy === "name"}
                sortDir={filters.sortDir}
                onToggleSort={() => setFilters(toggleSort(filters, "name"))}
              />
            </div>
            <div className="min-w-[8rem] flex-1">
              <MultiSelectFilter
                label={t("filterCity")}
                emptyLabel={tCommon("all")}
                values={filters.cities}
                onChange={(cities) => setFilters({ ...filters, cities })}
                options={cityOptions}
                sortActive={filters.sortBy === "city"}
                sortDir={filters.sortDir}
                onToggleSort={() => setFilters(toggleSort(filters, "city"))}
              />
            </div>
            <div className="min-w-[9rem] flex-1">
              <MultiSelectFilter
                label={t("filterBusinessType")}
                emptyLabel={tCommon("all")}
                values={filters.businessTypes}
                onChange={(businessTypes) =>
                  setFilters({
                    ...filters,
                    businessTypes: businessTypes as ClientBusinessType[],
                  })
                }
                options={businessTypeOptions}
                sortActive={filters.sortBy === "businessType"}
                sortDir={filters.sortDir}
                onToggleSort={() =>
                  setFilters(toggleSort(filters, "businessType"))
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={hasActiveFilters ? 0 : -1}
              aria-hidden={!hasActiveFilters}
              aria-disabled={!hasActiveFilters}
              aria-label={tFilters("clearFilters")}
              className={cn(
                "mb-0.5 h-10 shrink-0 rounded-full text-primary transition-opacity duration-500 ease-out hover:bg-primary-muted",
                hasActiveFilters
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
              )}
              onClick={() => {
                if (!hasActiveFilters) return;
                setFilters({
                  ...DEFAULT_FILTERS,
                  sortBy: filters.sortBy,
                  sortDir: filters.sortDir,
                });
              }}
            >
              <X className="h-3.5 w-3.5" />
              {tFilters("clearFilters")}
            </Button>
          </div>
          {hasActiveFilters ? (
            <p className="text-xs text-muted-foreground">
              {t("clientCountFiltered", {
                visible: visibleClients.length,
                total: clients.length,
              })}
            </p>
          ) : null}
        </section>

        <div className="min-h-0 flex-1">
          {clients.length === 0 ? (
            <Card solid>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("emptyHint")}
              </CardContent>
            </Card>
          ) : visibleClients.length === 0 ? (
            <Card solid>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("noFilterMatch")}
              </CardContent>
            </Card>
          ) : mode === "grid" ? (
            <div className={nexusGridClass}>
              {visibleClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          ) : (
            <Card solid className="overflow-hidden rounded-2xl border-border/70">
              <CardContent className="divide-y divide-border/60 p-0">
                {visibleClients.map((client) => {
                  const meta = [
                    client.phone,
                    client.email,
                    client.city,
                    client.address,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div
                      key={client.id}
                      className="px-3 py-3 sm:px-5 sm:py-3.5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                              nexusAvatarTone(client.id),
                            )}
                          >
                            {nexusInitials(client.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                                {client.code}
                              </span>
                              <h3 className="truncate text-sm font-semibold text-foreground">
                                {client.name}
                              </h3>
                              {client.businessType ? (
                                <span className="rounded-full bg-primary-muted px-2 py-0 text-[10px] font-semibold text-primary">
                                  {
                                    labels.clientBusinessType[
                                      client.businessType
                                    ]
                                  }
                                </span>
                              ) : null}
                              {client._count.matters > 0 ? (
                                <Link
                                  href={`/matters?clientId=${encodeURIComponent(client.id)}`}
                                  className="rounded-full bg-primary/10 px-2 py-0 text-[10px] font-semibold tabular-nums text-primary hover:bg-primary/15"
                                >
                                  {t("fieldMatters", {
                                    count: client._count.matters,
                                  })}
                                </Link>
                              ) : (
                                <span className="rounded-full bg-muted px-2 py-0 text-[10px] font-medium text-muted-foreground">
                                  {t("fieldMatters", { count: 0 })}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {meta || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                          {canManage ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => openEdit(client)}
                                className="h-8 rounded-full px-2.5"
                                aria-label={t("editClient")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                  {tCommon("edit")}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleDelete(client)}
                                className="h-8 rounded-full px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                                aria-label={`${tCommon("delete")} ${client.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editOpen ? (
        <ClientFormModal
          open={editOpen}
          initial={editClient}
          onClose={() => {
            setEditOpen(false);
            setEditClient(null);
          }}
        />
      ) : null}
      {undoToast ? (
        <UndoToast
          toastKey={undoToast.key}
          message={t("deletedToast", { name: undoToast.name })}
          undoLabel={tCommon("undo")}
          onUndo={async () => {
            const result = await restoreClientAction(undoToast.clientId);
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
