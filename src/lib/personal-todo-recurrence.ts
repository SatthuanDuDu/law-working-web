import {
  addDays,
  addMonths,
  getDate,
  getISODay,
  lastDayOfMonth,
  setDate,
  startOfDay,
} from "date-fns";
import type { PersonalTodoRecurrence } from "@prisma/client";

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function normalizeRecurrenceDays(
  days: number[] | undefined,
  fallbackFrom?: Date | null,
): number[] {
  const unique = [
    ...new Set(
      (days ?? []).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7),
    ),
  ].sort((a, b) => a - b);
  if (unique.length > 0) return unique;
  if (fallbackFrom) return [getISODay(fallbackFrom)];
  return [];
}

export function combineDueDate(
  date: Date,
  hasTime: boolean,
  timeHm: string,
): Date {
  const next = new Date(date);
  if (!hasTime) {
    return startOfDay(next);
  }
  const [hoursRaw, minutesRaw] = timeHm.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  next.setHours(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return next;
}

/**
 * Next occurrence after `due`. Weekly uses ISO weekdays (1=Mon … 7=Sun).
 * Monthly keeps the original day-of-month, clamped to the last day.
 */
export function nextPersonalTodoDue(
  due: Date,
  recurrence: PersonalTodoRecurrence,
  days: number[] = [],
  hasTime = false,
): Date | null {
  if (recurrence === "NONE") return null;

  let next: Date;
  if (recurrence === "DAILY") {
    next = addDays(due, 1);
  } else if (recurrence === "WEEKLY") {
    const selected = normalizeRecurrenceDays(days, due);
    const current = getISODay(due);
    const later = selected.find((day) => day > current);
    const target = later ?? selected[0] ?? current;
    const delta = later ? target - current : 7 - current + target;
    next = addDays(due, delta === 0 ? 7 : delta);
  } else if (recurrence === "MONTHLY") {
    const day = getDate(due);
    const shifted = addMonths(due, 1);
    next = setDate(shifted, Math.min(day, getDate(lastDayOfMonth(shifted))));
  } else {
    return null;
  }

  if (!hasTime) return startOfDay(next);
  return next;
}
