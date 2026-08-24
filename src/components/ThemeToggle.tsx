"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";

const STORAGE_KEY = "archivedia.theme";

/**
 * Toggle between light and dark themes. The choice is persisted to
 * localStorage and reflected on <html data-theme="...">. On the very
 * first visit we honour the OS-level `prefers-color-scheme` setting.
 *
 * A small inline script in the document head applies the theme attribute
 * before the React tree mounts, so the user never sees a flash of the
 * wrong palette.
 */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  // Label the *next* theme so screen-reader users know what the button
  // will do, while the visible glyph shows the current theme.
  const label = mounted ? (theme === "dark" ? t("light") : t("dark")) : t("toggle");
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center rounded-full border border-[var(--color-line)] bg-surface px-2 py-2 text-[var(--color-ink-soft)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] motion-safe:transition-colors motion-safe:duration-200"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="inline-block h-4 w-4">
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Inline script injected from the document <head> to set the theme
 * attribute before the React tree mounts. Without this the page would
 * flash the light palette for one frame on dark-mode devices.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem('${STORAGE_KEY}');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`.trim();
