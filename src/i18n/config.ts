/**
 * Locale catalog. v0.1 ships pt-BR (default) and en. Adding a new language
 * is just a matter of dropping a new file in `messages/` and registering
 * it here; components consume keys via next-intl and need no edits.
 */
export const locales = ["pt-BR", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-BR";

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
