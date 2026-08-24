import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Server-side i18n bootstrap. Reads the `locale` cookie set by the
 * middleware; falls back to the default locale (pt-BR) when unset or
 * invalid. Components use getTranslations() and getLocale() from
 * next-intl/server; this file just wires the runtime config.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("locale")?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
    timeZone: process.env.APP_TIMEZONE ?? "America/Sao_Paulo",
  };
});
