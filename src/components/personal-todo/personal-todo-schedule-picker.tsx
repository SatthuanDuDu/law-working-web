"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Repeat } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { PersonalTodoRecurrence } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ISO_WEEKDAYS, normalizeRecurrenceDays } from "@/lib/personal-todo-recurrence";
import { cn } from "@/lib/utils";

export type TodoScheduleValue = {
  dueDate: Date | null;
  hasTime: boolean;
  timeHm: string;
  recurrence: PersonalTodoRecurrence;
  recurrenceDays: number[];
};

const WEEKDAY_KEYS = [
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
  "weekdaySun",
] as const;

const RECURRENCE_OPTIONS: {
  value: PersonalTodoRecurrence;
  labelKey: "repeatNone" | "repeatDaily" | "repeatWeekly" | "repeatMonthly";
}[] = [
  { value: "NONE", labelKey: "repeatNone" },
  { value: "DAILY", labelKey: "repeatDaily" },
  { value: "WEEKLY", labelKey: "repeatWeekly" },
  { value: "MONTHLY", labelKey: "repeatMonthly" },
];

export function PersonalTodoSchedulePicker({
  value,
  onConfirm,
  onCancel,
}: {
  value: TodoScheduleValue;
  onConfirm: (next: TodoScheduleValue) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("personalTodo");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : vi;

  const [draft, setDraft] = useState<TodoScheduleValue>(value);
  const [month, setMonth] = useState(
    () => value.dueDate ?? new Date(),
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function selectDay(day: Date) {
    setDraft((prev) => {
      const nextDays =
        prev.recurrence === "WEEKLY"
          ? normalizeRecurrenceDays(prev.recurrenceDays, day)
          : prev.recurrenceDays;
      return { ...prev, dueDate: day, recurrenceDays: nextDays };
    });
  }

  function setRecurrence(recurrence: PersonalTodoRecurrence) {
    setDraft((prev) => {
      const dueDate = prev.dueDate ?? new Date();
      return {
        ...prev,
        dueDate,
        recurrence,
        recurrenceDays:
          recurrence === "WEEKLY"
            ? normalizeRecurrenceDays(prev.recurrenceDays, dueDate)
            : [],
      };
    });
  }

  function toggleWeekday(iso: number) {
    setDraft((prev) => {
      const current = normalizeRecurrenceDays(prev.recurrenceDays, prev.dueDate);
      const next = current.includes(iso)
        ? current.filter((day) => day !== iso)
        : [...current, iso].sort((a, b) => a - b);
      return {
        ...prev,
        recurrenceDays: next.length > 0 ? next : current,
      };
    });
  }

  return (
    <div
      className="todo-composer-enter rounded-md border border-border bg-primary-muted/40 p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold capitalize text-foreground">
          {format(month, "MMMM yyyy", { locale: dateLocale })}
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="interactive-press h-8 w-8"
            onClick={() => setMonth((prev) => subMonths(prev, 1))}
            aria-label={t("prevMonth")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="interactive-press h-8 w-8"
            onClick={() => setMonth((prev) => addMonths(prev, 1))}
            aria-label={t("nextMonth")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="text-[11px] font-medium text-muted-foreground">
            {t(key)}
          </span>
        ))}
        {days.map((day) => {
          const selected = draft.dueDate ? isSameDay(day, draft.dueDate) : false;
          const inMonth = isSameMonth(day, month);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => selectDay(day)}
              className={cn(
                "interactive-press mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm",
                !inMonth && "text-muted-foreground/50",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-primary-muted",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {draft.hasTime ? (
          <input
            type="time"
            value={draft.timeHm}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, timeHm: event.target.value }))
            }
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-foreground"
            aria-label={t("setTime")}
          />
        ) : (
          <button
            type="button"
            className="interactive-press h-10 flex-1 rounded-md border border-border bg-surface px-3 text-left text-sm text-muted-foreground"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                hasTime: true,
                dueDate: prev.dueDate ?? new Date(),
                timeHm: prev.timeHm || "09:00",
              }))
            }
          >
            {t("setTime")}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Repeat className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="font-medium">{t("repeat")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RECURRENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRecurrence(option.value)}
              className={cn(
                "interactive-press rounded-full border px-2.5 py-1 text-xs font-medium",
                draft.recurrence === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:bg-primary-muted",
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        {draft.recurrence === "WEEKLY" ? (
          <div className="flex flex-wrap gap-1">
            {ISO_WEEKDAYS.map((iso, index) => {
              const selected = draft.recurrenceDays.includes(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleWeekday(iso)}
                  className={cn(
                    "interactive-press h-8 min-w-8 rounded-full px-2 text-xs font-medium",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {t(WEEKDAY_KEYS[index])}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="interactive-press text-sm font-medium text-primary"
          onClick={onCancel}
        >
          {tCommon("cancel")}
        </button>
        <Button
          type="button"
          className="interactive-press rounded-full px-4"
          onClick={() => onConfirm(draft)}
        >
          {t("done")}
        </Button>
      </div>
    </div>
  );
}
