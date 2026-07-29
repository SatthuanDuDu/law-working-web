"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectOption = { value: string; label: string };

/**
 * Compact filter select (button + menu) — uses design-system text-sm.
 * Prefer this over native <select> in filter toolbars so mobile text
 * matches the rest of the UI (native selects are forced to 16px for iOS).
 */
export function FilterSelect({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const summary = selected?.label ?? options[0]?.label ?? "";

  function measureMenuBox() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    return { top: rect.bottom + 6, left, width };
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

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? closeMenu() : openMenu())}
        className={cn(
          "interactive-field flex h-10 w-full cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-left text-sm leading-normal text-foreground",
          "hover:border-primary/35 hover:bg-muted/90",
          open && "border-primary/40 bg-muted/90",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && menuBox
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
              className="fixed z-[60] max-h-56 overflow-y-auto rounded-[5px] border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={cn(
                        "interactive-press flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted",
                        isSelected && "bg-muted font-medium hover:bg-muted",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        closeMenu();
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-surface",
                        )}
                        aria-hidden
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
