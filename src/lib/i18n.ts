import { cookies } from "next/headers";
import { getLocale as nextIntlGetLocale } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

/**
 * Lightweight helpers for places that don't want to import next-intl
 * directly (route handlers, server actions, tests). The server-side
 * `getTranslations` from next-intl/server remains the preferred API for
 * React components.
 */
export async function getCurrentLocale(): Promise<Locale> {
  const fromNext = await nextIntlGetLocale();
  return isLocale(fromNext) ? fromNext : defaultLocale;
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export { defaultLocale, isLocale };
export type { Locale };
