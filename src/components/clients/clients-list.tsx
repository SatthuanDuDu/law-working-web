"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { deleteClientAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { CreateClientButton } from "@/components/clients/create-client-button";
import {
  ClientFormModal,
  type ClientFormInitial,
} from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import type { ClientBusinessType } from "@prisma/client";

export type ClientListItem = {
  id: string;
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
  names: string[];
  cities: string[];
  businessTypes: ClientBusinessType[];
  sortBy: ClientsSortBy;
  sortDir: "asc" | "desc";
};

const DEFAULT_FILTERS: ClientsFilterState = {
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
          "interactive-field flex h-10 w-full cursor-pointer items-center rounded-[5px] border border-border bg-surface pl-3 pr-1 text-sm",
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
  const filtered = clients.filter((client) => {
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
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const labels = useLabelMaps();
  const { confirm, dialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ClientsFilterState>(DEFAULT_FILTERS);
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientFormInitial | null>(null);

  function openEdit(client: ClientListItem) {
    setEditClient({
      id: client.id,
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

  const hasActiveFilters =
    filters.names.length > 0 ||
    filters.cities.length > 0 ||
    filters.businessTypes.length > 0;

  return (
    <>
      {dialog}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {visibleClients.length === clients.length
              ? t("clientCount", { count: clients.length })
              : t("clientCountFiltered", {
                  visible: visibleClients.length,
                  total: clients.length,
                })}
          </p>
          <CreateClientButton />
        </div>

        <div className="shrink-0 rounded-md border border-border bg-surface px-3 py-3">
          <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
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
                onToggleSort={() => setFilters(toggleSort(filters, "businessType"))}
              />
            </div>
            <div className="min-w-[7.5rem] flex-1 sm:max-w-[10rem]">
              <p className="mb-1 truncate text-xs text-muted-foreground">{t("filterMatterCount")}</p>
              <div
                className={cn(
                  "interactive-field flex h-10 w-full items-center justify-between gap-2 rounded-[5px] border border-border bg-surface px-3 text-sm",
                  "hover:border-primary/35 hover:bg-muted/90",
                  filters.sortBy === "matters" &&
                    "border-primary/40 bg-primary-muted/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => setFilters(toggleSort(filters, "matters"))}
                  className="interactive-press min-w-0 flex-1 truncate text-left"
                >
                  {filters.sortBy === "matters"
                    ? filters.sortDir === "asc"
                      ? tFilters("sortAsc")
                      : tFilters("sortDesc")
                    : tFilters("sort")}
                </button>
                <SortToggle
                  active={filters.sortBy === "matters"}
                  sortDir={filters.sortDir}
                  onToggle={() => setFilters(toggleSort(filters, "matters"))}
                  label={t("filterMatterCount")}
                />
              </div>
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
                hasActiveFilters ? "opacity-100" : "pointer-events-none opacity-0",
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
        </div>

        <div className="min-h-0 flex-1 space-y-4">
          {clients.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("emptyHint")}
              </CardContent>
            </Card>
          ) : visibleClients.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("noFilterMatch")}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[5px]">
              <CardContent className="divide-y divide-border/70 p-0">
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
                    <div key={client.id} className="px-4 py-3 sm:px-6">
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {client.name}
                            </h3>
                            {client.businessType ? (
                              <span className="rounded-full bg-primary-muted px-2 py-0 text-[10px] font-semibold text-primary">
                                {labels.clientBusinessType[client.businessType]}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-muted px-2 py-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {t("fieldMatters", { count: client._count.matters })}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {meta || "—"}
                          </p>
                          {client.notes ? (
                            <p className="mt-1 line-clamp-1 text-xs text-foreground/80">
                              {client.notes}
                            </p>
                          ) : null}
                        </div>

                        {canManage ? (
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
                        ) : null}
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
    </>
  );
}
