"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseIso(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
  className,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (next: { dateFrom: string; dateTo: string }) => void;
  className?: string;
}) {
  const t = useTranslations("admin.auditLogs");
  const tFilters = useTranslations("filters");
  const locale = useLocale();
  const dateFnsLocale = locale === "en" ? enUS : vi;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [draftFrom, setDraftFrom] = useState<Date | null>(null);
  const [draftTo, setDraftTo] = useState<Date | null>(null);

  function openPicker() {
    const from = parseIso(dateFrom);
    const to = parseIso(dateTo);
    setDraftFrom(from);
    setDraftTo(to);
    setViewMonth(startOfMonth(from ?? to ?? new Date()));
    setOpen(true);
  }

  useEffect(() => {
    if (!open || !rootRef.current) return;

    function position() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 300);
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );
      setMenuBox({
        top: rect.bottom + 6,
        left,
        width,
      });
    }

    position();
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return format(day, "EEEEE", { locale: dateFnsLocale });
    });
  }, [dateFnsLocale]);

  const summary = useMemo(() => {
    if (!dateFrom && !dateTo) return t("dateRangeAll");
    if (dateFrom && dateTo) {
      return `${formatDate(dateFrom, locale)} – ${formatDate(dateTo, locale)}`;
    }
    if (dateFrom) return `${t("dateFrom")}: ${formatDate(dateFrom, locale)}`;
    return `${t("dateTo")}: ${formatDate(dateTo, locale)}`;
  }, [dateFrom, dateTo, locale, t]);

  const hasValue = Boolean(dateFrom || dateTo);

  function selectDay(day: Date) {
    const value = startOfDay(day);
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(value);
      setDraftTo(null);
      return;
    }
    if (isBefore(value, draftFrom)) {
      setDraftTo(draftFrom);
      setDraftFrom(value);
      return;
    }
    setDraftTo(value);
  }

  function applyRange() {
    onChange({
      dateFrom: draftFrom ? toIsoDate(draftFrom) : "",
      dateTo: draftTo
        ? toIsoDate(draftTo)
        : draftFrom
          ? toIsoDate(draftFrom)
          : "",
    });
    setOpen(false);
  }

  function clearRange(event?: React.MouseEvent | React.KeyboardEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setDraftFrom(null);
    setDraftTo(null);
    onChange({ dateFrom: "", dateTo: "" });
    setOpen(false);
  }

  function inRange(day: Date) {
    if (!draftFrom || !draftTo) return false;
    return (
      (isAfter(day, draftFrom) || isSameDay(day, draftFrom)) &&
      (isBefore(day, draftTo) || isSameDay(day, draftTo))
    );
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openPicker();
        }}
        className={cn(
          "interactive-field flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm",
          "hover:border-primary/35 hover:bg-muted/90",
          open && "border-primary/40 bg-muted/90",
          hasValue &&
            "border-primary/40 bg-primary-muted/40 hover:bg-primary-muted/55",
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !hasValue && "text-foreground",
          )}
        >
          {summary}
        </span>
        {hasValue ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={tFilters("clearFilters")}
            className="interactive-press inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={clearRange}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") clearRange(event);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open && menuBox && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="dialog"
              aria-label={t("dateRange")}
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
              }}
              className="fixed z-[60] rounded-[5px] border border-border bg-surface p-3 shadow-[var(--shadow-overlay)]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMonth((month) => addMonths(month, -1))}
                  aria-label={t("prevMonth")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold capitalize text-foreground">
                  {format(viewMonth, "LLLL yyyy", { locale: dateFnsLocale })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMonth((month) => addMonths(month, 1))}
                  aria-label={t("nextMonth")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="mb-2 text-xs text-muted-foreground">
                {t("dateRangeHint")}
              </p>

              <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
                {weekdayLabels.map((label, index) => (
                  <span key={`${label}-${index}`} className="py-1">
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-0.5 grid grid-cols-7 gap-0.5">
                {days.map((day) => {
                  const outside = !isSameMonth(day, viewMonth);
                  const selectedStart = draftFrom
                    ? isSameDay(day, draftFrom)
                    : false;
                  const selectedEnd = draftTo ? isSameDay(day, draftTo) : false;
                  const selected = selectedStart || selectedEnd;
                  const ranged = inRange(day);

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn(
                        "interactive-press h-8 rounded-md text-sm tabular-nums transition-colors",
                        outside && "text-muted-foreground/45",
                        !outside && !selected && "text-foreground hover:bg-muted",
                        ranged && !selected && "bg-primary-muted/70 text-primary",
                        selected &&
                          "bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearRange()}
                >
                  {tFilters("clearFilters")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftFrom}
                  onClick={applyRange}
                >
                  {t("applyDateRange")}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
