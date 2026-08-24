import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";

const COOKIE_NAME = "locale";

/**
 * Cookie-only locale negotiation. On first visit we set the locale
 * cookie to the closest match of `Accept-Language` against the supported
 * list; later visits just read the cookie. There is no URL routing for
 * locale (the app is single-user) — see i18n/config.ts for the catalog.
 */
function negotiate(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(COOKIE_NAME)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const header = request.headers.get("accept-language") ?? "";
  const candidates = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    if (isLocale(candidate)) return candidate;
    const lang = candidate.split("-")[0];
    const match = locales.find((l) => l.toLowerCase().startsWith(lang));
    if (match) return match;
  }
  return defaultLocale;
}

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  if (!request.cookies.get(COOKIE_NAME)) {
    response.cookies.set(COOKIE_NAME, negotiate(request), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  // Skip Next.js internals and the API routes — the API stays locale-agnostic.
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
