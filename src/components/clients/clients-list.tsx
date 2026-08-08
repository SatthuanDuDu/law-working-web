"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { deleteClientAction, restoreClientAction, bulkDeleteClientsAction } from "@/lib/actions";
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
import { UndoToast } from "@/components/ui/undo-toast";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { downloadExcel } from "@/lib/export-excel";
import { cn } from "@/lib/utils";
import type { ClientBusinessType } from "@prisma/client";

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
  _count: { matters: number };
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

type Option = { value: string; label: string };

function SortToggle({
  active,
  sortDir,
  onToggle,
  label,
}: {
  active: boolean;
  sortDir: "asc" | "desc";
  onToggle: () => void;
  label: string;
}) {
  const t = useTranslations("filters");
  const direction = sortDir === "asc" ? t("sortAsc") : t("sortDesc");

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "interactive-press inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",
      )}
      aria-label={
        active
          ? t("sortActive", { label, direction })
          : `${label}: ${t("sort")}`
      }
      title={active ? direction : t("sort")}
    >
      {active && sortDir === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.25} />
      )}
    </button>
  );
}

function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  sortActive,
  sortDir,
  onToggleSort,
  emptyLabel,
}: {
  label: string;
  options: Option[];
  values: string[];
  onChange: (next: string[]) => void;
  sortActive: boolean;
  sortDir: "asc" | "desc";
  onToggleSort: () => void;
  emptyLabel: string;
}) {
  const t = useTranslations("filters");
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  function measureMenuBox() {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    return {
      top: rect.bottom + 6,
      left,
      width,
    };
  }

  function openMenu() {
    const nextBox = measureMenuBox();
    if (nextBox) setMenuBox(nextBox);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setMenuBox(null);
  }

  function toggleMenu() {
    if (open) {
      closeMenu();
      return;
    }
    openMenu();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onReposition() {
      const nextBox = measureMenuBox();
      if (nextBox) setMenuBox(nextBox);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  }

  const summary =
    values.length === 0
      ? emptyLabel
      : values.length === 1
        ? (options.find((option) => option.value === values[0])?.label ?? t("selectedOne"))
        : t("selectedCount", { count: values.length });

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <p className="mb-1 truncate text-xs text-muted-foreground">{label}</p>
      <div
        ref={fieldRef}
        className={cn(
          "interactive-field flex h-10 w-full cursor-pointer items-center rounded-[5px] border border-border bg-surface pl-3 pr-1 text-sm leading-normal",
          "hover:border-primary/35 hover:bg-muted/90",
          open && "border-primary/40 bg-muted/90",
          values.length > 0 && "border-primary/40 bg-primary-muted/40 hover:bg-primary-muted/55",
        )}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggleMenu}
          className="interactive-press flex min-h-10 min-w-0 flex-1 items-center text-left"
        >
          <span className="truncate">{summary}</span>
        </button>
        <SortToggle
          active={sortActive}
          sortDir={sortDir}
          onToggle={onToggleSort}
          label={label}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={toggleMenu}
          className="interactive-press inline-flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>
      {open && menuBox
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-multiselectable
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
              className="fixed z-[60] max-h-56 overflow-y-auto rounded-[5px] border border-border bg-surface py-1"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{t("noOptions")}</li>
              ) : (
                options.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <li key={option.value} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(
                          "interactive-press flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted",
                          selected && "bg-muted font-medium text-foreground hover:bg-muted",
                        )}
                        onClick={() => toggle(option.value)}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                            selected
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-surface",
                          )}
                          aria-hidden
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      [...new Set(clients.map((client) => client.city).filter(Boolean) as string[])]
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
    () => applyClientFilters(clients, filters, labels.clientBusinessType, locale),
    [clients, filters, labels.clientBusinessType, locale],
  );

  const selectableVisibleIds = useMemo(
    () => (canManage ? visibleClients.map((client) => client.id) : []),
    [visibleClients, canManage],
  );

  const activeSelectedIds = useMemo(() => {
    const visibleIdSet = new Set(visibleClients.map((client) => client.id));
    return new Set([...selectedIds].filter((id) => visibleIdSet.has(id)));
  }, [selectedIds, visibleClients]);

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

  function handleBulkDelete() {
    const ids = [...activeSelectedIds];
    if (ids.length === 0 || !canManage) return;
    confirm({
      title: t("confirmBulkDeleteTitle"),
      message: t("confirmBulkDeleteMessage", { count: ids.length }),
      confirmLabel: t("deleteConfirmLabel"),
      cancelLabel: tCommon("cancel"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await bulkDeleteClientsAction(ids);
          if (result.error) {
            confirm({
              title: tCommon("cannotDelete"),
              message: result.error,
              confirmLabel: tCommon("close"),
              onConfirm: () => undefined,
            });
            return;
          }
          setSelectedIds(new Set());
          if (result.skipped && result.skipped > 0) {
            confirm({
              title: tCommon("cannotDelete"),
              message: t("bulkDeletePartial", {
                deleted: result.deleted ?? 0,
                skipped: result.skipped,
              }),
              confirmLabel: tCommon("close"),
              onConfirm: () => undefined,
            });
          }
          router.refresh();
        });
      },
    });
  }

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

  function MatterCountChip({ client }: { client: ClientListItem }) {
    const count = client._count.matters;
    const label = t("fieldMatters", { count });
    if (count <= 0) {
      return (
        <span
          className="rounded-full bg-muted px-2 py-0 text-[10px] font-medium tabular-nums text-muted-foreground"
          title={t("noRelatedMatters")}
          aria-disabled
        >
          {label}
        </span>
      );
    }
    return (
      <Link
        href={`/matters?clientId=${encodeURIComponent(client.id)}`}
        className="interactive-press rounded-full bg-primary/10 px-2 py-0 text-[10px] font-semibold tabular-nums text-primary hover:bg-primary/15"
        title={t("viewRelatedMatters", { count })}
        aria-label={t("viewRelatedMatters", { count })}
      >
        {label}
      </Link>
    );
  }

  function ClientActions({ client }: { client: ClientListItem }) {
    if (!canManage) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => openEdit(client)}
          className="h-8 px-2.5"
          aria-label={t("editClient")}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tCommon("edit")}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => handleDelete(client)}
          className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
          aria-label={`${tCommon("delete")} ${client.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {dialog}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="shrink-0 space-y-2.5 border-b border-border/60 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-10 pl-9"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto pb-0.5">
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
                  "h-10 shrink-0 text-red-600 transition-opacity duration-500 ease-out hover:bg-red-50 hover:text-red-700",
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
            <div className="shrink-0 self-end pb-0.5">
              <CreateClientButton />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={visibleClients.length === 0}
            onClick={handleExportExcel}
            aria-label={tCommon("exportExcel")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
          </Button>
          <ListViewToggle mode={mode} onChange={setMode} size="sm" showTable={false} />
        </div>

        {canManage && activeSelectedIds.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary-muted/50 px-3 py-2 backdrop-blur-sm">
            <span className="text-sm font-medium text-primary">
              {t("selectedCount", { count: activeSelectedIds.size })}
            </span>
            {selectableVisibleIds.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAllVisible}
              >
                {tCommon("selectAll")}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleBulkDelete}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("bulkDelete")}
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

        <div className="min-h-0 flex-1 space-y-4">
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  <Card key={client.id} solid className="rounded-md border-border/50">
                    <CardContent className="flex h-full flex-col gap-2 p-3 sm:gap-3 sm:p-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canManage ? (
                            <input
                              type="checkbox"
                              checked={activeSelectedIds.has(client.id)}
                              onChange={() => toggleSelected(client.id)}
                              aria-label={client.name}
                              className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
                            />
                          ) : null}
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                            {client.code}
                          </span>
                          {client.businessType ? (
                            <span className="rounded-full bg-primary-muted px-2 py-0 text-[10px] font-semibold text-primary">
                              {labels.clientBusinessType[client.businessType]}
                            </span>
                          ) : null}
                          <MatterCountChip client={client} />
                        </div>
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {client.name}
                        </h3>
                        <p className="line-clamp-1 text-xs text-muted-foreground sm:line-clamp-2">
                          {meta || "—"}
                        </p>
                        {client.notes ? (
                          <p className="hidden line-clamp-2 text-xs text-foreground/80 sm:block">
                            {client.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-auto">
                        <ClientActions client={client} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card solid className="rounded-md border-border/50">
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
                    <div key={client.id} className="px-3 py-2.5 sm:px-5 sm:py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {canManage ? (
                            <input
                              type="checkbox"
                              checked={activeSelectedIds.has(client.id)}
                              onChange={() => toggleSelected(client.id)}
                              aria-label={client.name}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                                {client.code}
                              </span>
                              <h3 className="truncate text-sm font-semibold text-foreground">
                                {client.name}
                              </h3>
                              {client.businessType ? (
                                <span className="rounded-full bg-primary-muted px-2 py-0 text-[10px] font-semibold text-primary">
                                  {labels.clientBusinessType[client.businessType]}
                                </span>
                              ) : null}
                              <MatterCountChip client={client} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {meta || "—"}
                            </p>
                            {client.notes ? (
                              <p className="mt-0.5 line-clamp-1 text-xs text-foreground/80 sm:mt-1">
                                {client.notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <ClientActions client={client} />
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

