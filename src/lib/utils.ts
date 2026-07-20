import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/i18n/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function localeTag(locale?: Locale | string): string {
  return locale === "en" ? "en-US" : "vi-VN";
}

export function formatMinutes(
  minutes: number,
  locale?: Locale | string,
  t?: (key: string, values?: Record<string, number>) => string,
): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (t) {
    if (hours === 0) return t("minutes", { count: mins });
    if (mins === 0) return t("hours", { count: hours });
    return t("hoursMinutes", { hours, mins });
  }
  if (locale === "en") {
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours} h ${mins} min`;
  }
  if (hours === 0) return `${mins} phút`;
  if (mins === 0) return `${hours} giờ`;
  return `${hours} giờ ${mins} phút`;
}

export function formatDate(
  date: Date | string,
  locale?: Locale | string,
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(
  date: Date | string,
  locale?: Locale | string,
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
