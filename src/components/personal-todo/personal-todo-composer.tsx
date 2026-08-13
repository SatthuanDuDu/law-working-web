"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  format,
  getISODay,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";
import { AlignLeft, Circle, Clock, Repeat } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { PersonalTodoRecurrence } from "@prisma/client";
import {
  PersonalTodoSchedulePicker,
  type TodoScheduleValue,
} from "@/components/personal-todo/personal-todo-schedule-picker";
import { combineDueDate } from "@/lib/personal-todo-recurrence";
import type { PersonalTodoDto } from "@/lib/personal-todo-actions";
import { cn } from "@/lib/utils";

export type TodoComposerPayload = {
  title: string;
  note: string | null;
  dueDate: string | null;
  hasTime: boolean;
  recurrence: PersonalTodoRecurrence;
  recurrenceDays: number[];
};

function fromTodo(todo?: PersonalTodoDto): TodoScheduleValue & {
  title: string;
  note: string;
} {
  const due = todo?.dueDate ? new Date(todo.dueDate) : null;
  return {
    title: todo?.title ?? "",
    note: todo?.note ?? "",
    dueDate: due,
    hasTime: Boolean(todo?.hasTime && due),
    timeHm: due && todo?.hasTime ? format(due, "HH:mm") : "09:00",
    recurrence: todo?.recurrence ?? "NONE",
    recurrenceDays: todo?.recurrenceDays ?? [],
  };
}

function toPayload(
  title: string,
  note: string,
  schedule: TodoScheduleValue,
): TodoComposerPayload {
  const due = schedule.dueDate
    ? combineDueDate(schedule.dueDate, schedule.hasTime, schedule.timeHm)
    : null;
  const recurrence = due ? schedule.recurrence : "NONE";
  return {
    title: title.trim(),
    note: note.trim() || null,
    dueDate: due ? due.toISOString() : null,
    hasTime: Boolean(due && schedule.hasTime),
    recurrence,
    recurrenceDays: recurrence === "WEEKLY" ? schedule.recurrenceDays : [],
  };
}

export function PersonalTodoComposer({
  initial,
  onSave,
  onCancel,
}: {
  initial?: PersonalTodoDto;
  onSave: (payload: TodoComposerPayload) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("personalTodo");
  const locale = useLocale();
  const seeded = fromTodo(initial);
  const [title, setTitle] = useState(seeded.title);
  const [note, setNote] = useState(seeded.note);
  const [schedule, setSchedule] = useState<TodoScheduleValue>(seeded);
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function applyChip(daysFromNow: number) {
    const next = addDays(startOfDay(new Date()), daysFromNow);
    setSchedule((prev) => ({
      ...prev,
      dueDate: next,
      recurrenceDays:
        prev.recurrence === "WEEKLY"
          ? prev.recurrenceDays.length > 0
            ? prev.recurrenceDays
            : [getISODay(next)]
          : prev.recurrenceDays,
    }));
  }

  function submit() {
    const payload = toPayload(title, note, schedule);
    if (!payload.title) return;
    onSave(payload);
  }

  const todaySelected =
    schedule.dueDate && isToday(schedule.dueDate) && !schedule.hasTime;
  const tomorrowSelected =
    schedule.dueDate && isTomorrow(schedule.dueDate) && !schedule.hasTime;

  let dueHint: string | null = null;
  if (schedule.dueDate) {
    if (isToday(schedule.dueDate)) dueHint = t("today");
    else if (isTomorrow(schedule.dueDate)) dueHint = t("tomorrow");
    else {
      dueHint = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
        day: "numeric",
        month: "short",
      }).format(schedule.dueDate);
    }
    if (schedule.hasTime) dueHint += ` · ${schedule.timeHm}`;
  }

  return (
    <div
      className="todo-composer-enter border-b border-border/50 bg-primary-muted/30 px-3 py-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pickerOpen) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="flex items-start gap-2">
        <Circle className="mt-1.5 h-5 w-5 shrink-0 text-primary/50" aria-hidden />
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
      </div>

      <div className="mt-2 flex items-start gap-2 pl-7">
        <AlignLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("detailsPlaceholder")}
          aria-label={t("detailsPlaceholder")}
          rows={2}
          className="min-w-0 flex-1 resize-none bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/80"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-7">
        <button
          type="button"
          onClick={() => applyChip(0)}
          className={cn(
            "interactive-press rounded-full border px-2.5 py-1 text-xs font-medium",
            todaySelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-foreground hover:bg-primary-muted",
          )}
        >
          {t("today")}
        </button>
        <button
          type="button"
          onClick={() => applyChip(1)}
          className={cn(
            "interactive-press rounded-full border px-2.5 py-1 text-xs font-medium",
            tomorrowSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-foreground hover:bg-primary-muted",
          )}
        >
          {t("tomorrow")}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="interactive-press inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-primary hover:bg-primary-muted"
          aria-label={t("setTime")}
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            "interactive-press inline-flex h-7 w-7 items-center justify-center rounded-full border bg-surface hover:bg-primary-muted",
            schedule.recurrence !== "NONE"
              ? "border-primary text-primary"
              : "border-border text-muted-foreground",
          )}
          aria-label={t("repeat")}
        >
          <Repeat className="h-3.5 w-3.5" />
        </button>
        {dueHint ? (
          <span className="text-[11px] font-medium text-primary">{dueHint}</span>
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="mt-3 pl-0 sm:pl-7">
          <PersonalTodoSchedulePicker
            value={schedule}
            onConfirm={(next) => {
              setSchedule(next);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2 pl-7">
          <button
            type="button"
            className="interactive-press text-sm text-muted-foreground"
            onClick={onCancel}
          >
            {t("cancelComposer")}
          </button>
          <button
            type="button"
            className="interactive-press rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-40"
            disabled={!title.trim()}
            onClick={submit}
          >
            {t("saveTask")}
          </button>
        </div>
      )}
    </div>
  );
}
