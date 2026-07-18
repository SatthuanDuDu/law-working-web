"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MATTER_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MatterType } from "@prisma/client";

export type MattersSortBy = "type" | "lawyer" | "member" | "client" | "createdAt";

export type MattersFilterState = {
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
  types: [],
  lawyerIds: [],
  memberIds: [],
  clientIds: [],
  dateFrom: "",
  dateTo: "",
  sortBy: "createdAt",
  sortDir: "desc",
};

type Option = { value: string; label: string };

function SortToggle({
  active,
  sortDir,
  onToggle,
  label,
  className,
}: {
  active: boolean;
  sortDir: "asc" | "desc";
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "interactive-press inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors",
        "hover:bg-slate-100 hover:text-slate-700",
        active &&
          "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",
        className,
      )}
      aria-label={
        active
          ? `${label}: đang ${sortDir === "asc" ? "tăng dần" : "giảm dần"} — nhấn để đổi`
          : `${label}: sắp xếp`
      }
      title={active ? (sortDir === "asc" ? "Tăng dần" : "Giảm dần") : "Sắp xếp"}
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
  emptyLabel = "Tất cả",
}: {
  label: string;
  options: Option[];
  values: string[];
  onChange: (next: string[]) => void;
  sortActive: boolean;
  sortDir: "asc" | "desc";
  onToggleSort: () => void;
  emptyLabel?: string;
}) {
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
        ? (options.find((option) => option.value === values[0])?.label ?? "1 đã chọn")
        : `${values.length} đã chọn`;

  return (
    <div className="relative min-w-0 w-full" ref={rootRef}>
      <p className="mb-1 truncate text-xs text-slate-500">{label}</p>
      <div
        ref={fieldRef}
        className={cn(
          "interactive-field flex h-10 w-full cursor-pointer items-center rounded-lg border border-slate-300 bg-white pl-3 pr-1 text-sm",
          "hover:border-primary/35 hover:bg-slate-50/90",
          open && "border-primary/40 bg-slate-50/90",
          values.length > 0 && "border-primary/40 bg-primary-muted/40 hover:bg-primary-muted/55",
        )}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggleMenu}
          className="interactive-press flex min-h-10 min-w-0 flex-1 cursor-pointer items-center text-left"
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
          className="interactive-press inline-flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
              className="fixed z-[60] max-h-56 overflow-y-auto rounded-[5px] border border-slate-200/80 bg-white py-1"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">Không có lựa chọn</li>
              ) : (
                options.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <li key={option.value} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(
                          "interactive-press flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50",
                          selected && "bg-slate-50 font-medium text-slate-900 hover:bg-slate-100",
                        )}
                        onClick={() => toggle(option.value)}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                            selected
                              ? "border-primary bg-primary text-white"
                              : "border-slate-300 bg-white",
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
}: {
  filters: MattersFilterState;
  onChange: (next: MattersFilterState) => void;
  typeOptions: MatterType[];
  lawyers: { id: string; name: string }[];
  members: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}) {
  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.lawyerIds.length > 0 ||
    filters.memberIds.length > 0 ||
    filters.clientIds.length > 0 ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className="rounded-md border border-slate-200/80 bg-white px-3 py-3">
      <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
        <div className="min-w-[8.5rem] flex-1">
          <MultiSelectFilter
            label="Loại hình"
            values={filters.types}
            onChange={(types) => onChange({ ...filters, types: types as MatterType[] })}
            options={typeOptions.map((type) => ({
              value: type,
              label: MATTER_TYPE_LABELS[type],
            }))}
            sortActive={filters.sortBy === "type"}
            sortDir={filters.sortDir}
            onToggleSort={() => onChange(toggleSort(filters, "type"))}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <MultiSelectFilter
            label="Luật sư phụ trách"
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
            label="Thành viên cộng tác"
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
            label="Khách hàng (công ty)"
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
            className="mb-1 block truncate text-xs text-slate-500"
          >
            Từ ngày
          </label>
          <Input
            id="matter-filter-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
            className="cursor-pointer hover:border-primary/35 hover:bg-slate-50/90"
          />
        </div>
        <div className="min-w-[10rem] flex-1 sm:max-w-[12rem]">
          <label
            htmlFor="matter-filter-to"
            className="mb-1 block truncate text-xs text-slate-500"
          >
            Đến ngày
          </label>
          <div className="relative">
            <Input
              id="matter-filter-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
              className="cursor-pointer pr-9 hover:border-primary/35 hover:bg-slate-50/90"
            />
            <SortToggle
              active={filters.sortBy === "createdAt"}
              sortDir={filters.sortDir}
              onToggle={() => onChange(toggleSort(filters, "createdAt"))}
              label="Ngày tạo"
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
          aria-label="Xóa lọc"
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
          Xóa lọc
        </Button>
      </div>
    </div>
  );
}
