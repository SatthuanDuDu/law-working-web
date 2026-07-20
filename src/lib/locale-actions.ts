"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) {
    return { error: "Invalid locale" as const };
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale as Locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
