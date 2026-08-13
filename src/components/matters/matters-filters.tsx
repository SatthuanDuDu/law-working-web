"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MultiSelectFilter,
  SortToggle,
} from "@/components/ui/multi-select-filter";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { cn } from "@/lib/utils";
import type { MatterType } from "@prisma/client";

export type MattersSortBy = "type" | "lawyer" | "member" | "client" | "createdAt";

export type MattersFilterState = {
  query: string;
  types: MatterType[];
  lawyerIds: string[];
  memberIds: string[];
  clientIds: string[];
  dateFrom: string;
  dateTo: string;
  sortBy: MattersSortBy;
  sortDir: "asc" | "desc";
};

export const DEFAULT_MATTERS_FILTERS: MattersFilterState = {
  query: "",
  types: [],
  lawyerIds: [],
  memberIds: [],
  clientIds: [],
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
};

function toggleSort(
  filters: MattersFilterState,
  sortBy: MattersSortBy,
): MattersFilterState {
  if (filters.sortBy === sortBy) {
    return {
      ...filters,
      sortDir: filters.sortDir === "asc" ? "desc" : "asc",
    };
  }
  return { ...filters, sortBy, sortDir: "asc" };
}

export function MattersFiltersBar({
  filters,
  onChange,
  typeOptions,
  lawyers,
  members,
  clients,
  className,
}: {
  filters: MattersFilterState;
  onChange: (next: MattersFilterState) => void;
  typeOptions: MatterType[];
  lawyers: { id: string; name: string }[];
  members: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  className?: string;
}) {
  const t = useTranslations("matters");
  const tFilters = useTranslations("filters");
  const tCommon = useTranslations("common");
  const labels = useLabelMaps();

  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.types.length > 0 ||
    filters.lawyerIds.length > 0 ||
    filters.memberIds.length > 0 ||
    filters.clientIds.length > 0 ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className={cn("w-full min-w-0 space-y-2.5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-10 pl-9"
        />
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
        <div className="min-w-[8.5rem] flex-1">
          <MultiSelectFilter
            label={t("filterType")}
            emptyLabel={tCommon("all")}
            values={filters.types}
            onChange={(types) => onChange({ ...filters, types: types as MatterType[] })}
            options={typeOptions.map((type) => ({
              value: type,
              label: labels.matterType[type],
            }))}
            sortActive={filters.sortBy === "type"}
            sortDir={filters.sortDir}
            onToggleSort={() => onChange(toggleSort(filters, "type"))}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <MultiSelectFilter
            label={t("filterLeadLawyer")}
            emptyLabel={tCommon("all")}
            values={filters.lawyerIds}
            onChange={(lawyerIds) => onChange({ ...filters, lawyerIds })}
            options={lawyers.map((lawyer) => ({
              value: lawyer.id,
              label: lawyer.name,
            }))}
            sortActive={filters.sortBy === "lawyer"}
            sortDir={filters.sortDir}
            onToggleSort={() => onChange(toggleSort(filters, "lawyer"))}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <MultiSelectFilter
            label={t("filterMembers")}
            emptyLabel={tCommon("all")}
            values={filters.memberIds}
            onChange={(memberIds) => onChange({ ...filters, memberIds })}
            options={members.map((member) => ({
              value: member.id,
              label: member.name,
            }))}
            sortActive={filters.sortBy === "member"}
            sortDir={filters.sortDir}
            onToggleSort={() => onChange(toggleSort(filters, "member"))}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <MultiSelectFilter
            label={t("filterClient")}
            emptyLabel={tCommon("all")}
            values={filters.clientIds}
            onChange={(clientIds) => onChange({ ...filters, clientIds })}
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            sortActive={filters.sortBy === "client"}
            sortDir={filters.sortDir}
            onToggleSort={() => onChange(toggleSort(filters, "client"))}
          />
        </div>
        <div className="min-w-[9rem] flex-1 sm:max-w-[11rem]">
          <label
            htmlFor="matter-filter-from"
            className="mb-1 block truncate text-xs text-muted-foreground"
          >
            {tFilters("dateFrom")}
          </label>
          <Input
            id="matter-filter-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
            className="cursor-pointer hover:border-primary/35 hover:bg-muted/90"
          />
        </div>
        <div className="min-w-[10rem] flex-1 sm:max-w-[12rem]">
          <label
            htmlFor="matter-filter-to"
            className="mb-1 block truncate text-xs text-muted-foreground"
          >
            {tFilters("dateTo")}
          </label>
          <div className="relative">
            <Input
              id="matter-filter-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
              className="cursor-pointer pr-9 hover:border-primary/35 hover:bg-muted/90"
            />
            <SortToggle
              active={filters.sortBy === "createdAt"}
              sortDir={filters.sortDir}
              onToggle={() => onChange(toggleSort(filters, "createdAt"))}
              label={t("filterCreatedAt")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
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
            "h-10 shrink-0 text-red-600 transition-[opacity,background-color,color] duration-500 ease-out hover:bg-red-50 hover:text-red-700",
            hasActiveFilters ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => {
            if (!hasActiveFilters) return;
            onChange({
              ...DEFAULT_MATTERS_FILTERS,
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
  );
}
