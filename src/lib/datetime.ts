/** App wall-clock timezone. All user-facing times and naive form values are Vietnam. */
export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_OFFSET = "+07:00";

type VietnamParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function vietnamParts(date: Date): VietnamParts {
  const bag: Partial<VietnamParts> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    if (part.type === "year") bag.year = part.value;
    if (part.type === "month") bag.month = part.value;
    if (part.type === "day") bag.day = part.value;
    if (part.type === "hour") bag.hour = part.value;
    if (part.type === "minute") bag.minute = part.value;
  }
  return {
    year: bag.year ?? "1970",
    month: bag.month ?? "01",
    day: bag.day ?? "01",
    hour: bag.hour ?? "00",
    minute: bag.minute ?? "00",
  };
}

/**
 * Parse a form datetime into an absolute instant.
 * Naive `datetime-local` / `date` strings (no Z / offset) are Vietnam time, not UTC.
 */
export function parseAppDateTime(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const dated = new Date(trimmed);
    return Number.isNaN(dated.getTime()) ? null : dated;
  }

  const local = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (local) {
    const dated = new Date(
      `${local[1]}T${local[2]}:${local[3] ?? "00"}${VIETNAM_OFFSET}`,
    );
    return Number.isNaN(dated.getTime()) ? null : dated;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const dated = new Date(`${trimmed}T00:00:00${VIETNAM_OFFSET}`);
    return Number.isNaN(dated.getTime()) ? null : dated;
  }

  const dated = new Date(trimmed);
  return Number.isNaN(dated.getTime()) ? null : dated;
}

/** `YYYY-MM-DD` in Vietnam (for `<input type="date">` and filenames). */
export function toVietnamDateInput(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day } = vietnamParts(date);
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DDTHH:mm` in Vietnam (for `<input type="datetime-local">`). */
export function toVietnamDatetimeLocalValue(
  value: Date | string | null | undefined,
): string {
  if (value == null || value === "") return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day, hour, minute } = vietnamParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function nowVietnamDatetimeLocalValue(now = new Date()): string {
  return toVietnamDatetimeLocalValue(now);
}

export function startOfVietnamDay(now = new Date()): Date {
  return new Date(`${toVietnamDateInput(now)}T00:00:00${VIETNAM_OFFSET}`);
}

/** Inclusive end of the Vietnam calendar day `daysAhead` after today (0 = today). */
export function endOfVietnamDayPlus(daysAhead: number, now = new Date()): Date {
  const start = startOfVietnamDay(now);
  return new Date(start.getTime() + (daysAhead + 1) * 86_400_000 - 1);
}

export function getVietnamDayRange(now = new Date()) {
  const start = startOfVietnamDay(now);
  const end = new Date(start.getTime() + 86_400_000);
  const dateId = toVietnamDateInput(now).replace(/-/g, "");
  return { dateId, start, end };
}
