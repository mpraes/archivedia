"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

/**
 * Posts the chosen locale to /api/locale (which sets the cookie and
 * returns 204), then refreshes the page so server-rendered copy updates.
 */
export function LanguageSwitcher() {
  const router = useRouter();
  const current = useLocale();
  const t = useTranslations("switcher");
  const [pending, startTransition] = useTransition();

  const select = (next: Locale) => {
    if (next === current) return;
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  };

  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
      <span className="sr-only">{t("label")}</span>
      <select
        value={current}
        onChange={(event) => select(event.target.value as Locale)}
        disabled={pending}
        aria-label={t("label")}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)]"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
