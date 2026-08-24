// Lightweight endpoint that lets the client-side language switcher
// persist the chosen locale in a cookie. The middleware reads it on the
// next request and surfaces it through next-intl's request config.

import { NextResponse } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";

export async function POST(req: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const locale = (payload as { locale?: unknown })?.locale;
  if (typeof locale !== "string" || !isLocale(locale)) {
    return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 422 });
  }

  const response = NextResponse.json({ ok: true, locale: locale satisfies Locale });
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
