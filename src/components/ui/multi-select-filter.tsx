"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

export function SortToggle({
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
        active &&
          "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary",
        className,
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

export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  emptyLabel,
  sortActive,
  sortDir,
  onToggleSort,
}: {
  label: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
  sortActive?: boolean;
  sortDir?: "asc" | "desc";
  onToggleSort?: () => void;
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
  const labelId = useId();
  const showSort = Boolean(onToggleSort);

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
        ? (options.find((option) => option.value === values[0])?.label ??
          t("selectedOne"))
        : t("selectedCount", { count: values.length });

  return (
    <div className="relative min-w-0 w-full" ref={rootRef}>
      <p
        id={labelId}
        className="mb-1 truncate text-xs text-muted-foreground"
      >
        {label}
      </p>
      <div
        ref={fieldRef}
        className={cn(
          "interactive-field flex h-10 w-full cursor-pointer items-center rounded-md border border-border bg-surface pl-3 pr-1 text-sm leading-normal",
          "hover:border-primary/40 hover:bg-muted/90",
          open && "border-primary/40 bg-muted/90",
          values.length > 0 &&
            "border-primary/40 bg-primary-muted/40 hover:bg-primary-muted/55",
        )}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={labelId}
          onClick={toggleMenu}
          className="interactive-press flex min-h-10 min-w-0 flex-1 cursor-pointer items-center text-left"
        >
          <span className="truncate">{summary}</span>
        </button>
        {showSort && sortDir && onToggleSort ? (
          <SortToggle
            active={Boolean(sortActive)}
            sortDir={sortDir}
            onToggle={onToggleSort}
            label={label}
          />
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={toggleMenu}
          className="interactive-press inline-flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
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
              className="fixed z-[60] max-h-56 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t("noOptions")}
                </li>
              ) : (
                options.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={selected}
                    >
                      <button
                        type="button"
                        className={cn(
                          "interactive-press flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted",
                          selected &&
                            "bg-muted font-medium text-foreground hover:bg-muted",
                        )}
                        onClick={() => toggle(option.value)}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface",
                          )}
                          aria-hidden
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
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
