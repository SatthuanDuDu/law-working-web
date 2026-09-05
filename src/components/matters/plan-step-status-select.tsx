"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { MatterPlanStepStatus } from "@prisma/client";
import {
  PLAN_STEP_STATUS_DOT,
  PLAN_STEP_STATUS_TONES,
} from "@/lib/status-tokens";
import { cn } from "@/lib/utils";

export function PlanStepStatusSelect({
  value,
  onChange,
  options,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: {
  value: MatterPlanStepStatus;
  onChange: (value: MatterPlanStepStatus) => void;
  options: { value: MatterPlanStepStatus; label: string }[];
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
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
  const label = selected?.label ?? value;

  function measureMenuBox() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    return { top: rect.bottom + 6, left, width };
  }

  function openMenu() {
    if (disabled) return;
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
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? closeMenu() : openMenu())}
        className={cn(
          "interactive-press inline-flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-full px-2.5 text-left text-xs font-semibold leading-none",
          "ring-1 ring-inset ring-black/5 dark:ring-white/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "@min-[32rem]/step:w-auto @min-[32rem]/step:min-w-[8.5rem]",
          PLAN_STEP_STATUS_TONES[value],
          open && "ring-primary/25",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              PLAN_STEP_STATUS_DOT[value],
            )}
            aria-hidden
          />
          <span className="min-w-0 truncate">{label}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform",
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
              className="fixed z-[70] max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-surface p-1 shadow-[var(--shadow-overlay)]"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={cn(
                        "interactive-press flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors",
                        "hover:bg-surface-container",
                        isSelected && "bg-primary-muted font-medium text-primary",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        closeMenu();
                      }}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          PLAN_STEP_STATUS_DOT[option.value],
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {option.label}
                      </span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
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
