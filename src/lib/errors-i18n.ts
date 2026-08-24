import { getTranslations } from "next-intl/server";
import { ApiError } from "./api";

/**
 * Translate an API error into the active locale. Server components call
 * this with no arguments (next-intl resolves the request locale);
 * client callers pass the `t` function from useTranslations so the
 * translation happens on the server.
 */
export async function translateError(err: ApiError): Promise<string> {
  const t = await getTranslations("errors");
  if (err.code === "VALIDATION_ERROR" && err.fields) {
    const first = Object.values(err.fields)[0];
    return first ?? t("VALIDATION_ERROR");
  }
  if (err.code in errorCodes) {
    return t(err.code);
  }
  return err.message;
}

/**
 * Synchronous variant for client components that already hold a `t`
 * function. Looks up the catalog key by code; falls back to the
 * upstream message for codes the server can produce but the catalog
 * doesn't translate yet.
 */
export function translateErrorSync(
  err: ApiError,
  t: (key: string) => string,
): string {
  if (err.code === "VALIDATION_ERROR" && err.fields) {
    const first = Object.values(err.fields)[0];
    return first ?? t("VALIDATION_ERROR");
  }
  if (err.code in errorCodes) {
    return t(err.code);
  }
  return err.message;
}

const errorCodes = {
  VALIDATION_ERROR: true,
  NOTE_NOT_FOUND: true,
  NOTE_NOT_PROCESSABLE: true,
  INVALID_DATE: true,
  INVALID_TIMEZONE: true,
  DATABASE_UNAVAILABLE: true,
  INTERNAL_ERROR: true,
} as const;
