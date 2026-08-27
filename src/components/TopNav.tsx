"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  /** Translation key under the `nav` namespace (e.g. "today" → nav.today). */
  labelKey: "today" | "review" | "notes" | "spaces";
  /** Pathname prefixes that mark this item as active. The first item
   *  whose prefix matches the current pathname wins. */
  matchPrefix: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "today", matchPrefix: "/" },
  { href: "/review", labelKey: "review", matchPrefix: "/review" },
  { href: "/?status=permanent", labelKey: "notes", matchPrefix: "/notes" },
  { href: "/spaces", labelKey: "spaces", matchPrefix: "/spaces" },
];

/**
 * Structural skeleton for the top navigation. Active-state detection is
 * pathname-based; the visual treatment (spacing, hover, active pill,
 * review badge) is owned by the designer in a follow-up pass.
 *
 * "Notes" intentionally routes to the Today view filtered by
 * status=permanent, matching the doc's table: Notes = "Where is an idea
 * that you've already written?" until a dedicated Notes index exists.
 */
export function TopNav() {
  const pathname = usePathname() || "/";
  const t = useTranslations("nav");
  const tBrand = useTranslations("metadata");

  // Active state: the FIRST item whose matchPrefix is a prefix of the
  // current pathname. Order matters — Today ("/") must be last so the
  // other sections win when applicable.
  const orderedForMatch = [...NAV_ITEMS].reverse();
  const activeLabel = orderedForMatch.find((item) =>
    item.matchPrefix === "/"
      ? pathname === "/"
      : pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-surface/95 backdrop-blur-[6px]">
      <nav
        aria-label={t("brand")}
        className="mx-auto flex w-full max-w-[74.88rem] items-center gap-4 px-4 py-3.5 sm:px-6"
      >
        <Link
          href="/"
          className="font-[var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-ink)] transition-colors duration-200 hover:text-[var(--color-accent)]"
        >
          {tBrand("title").split("—")[0].trim()}
        </Link>
        <ul className="ml-auto flex flex-wrap items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive = activeLabel?.labelKey === item.labelKey;
            return (
              <li key={item.labelKey}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "rounded-full bg-[var(--color-accent-soft)] px-3.5 py-1.5 font-medium text-[var(--color-accent)] transition-colors duration-200"
                      : "rounded-full px-3.5 py-1.5 font-medium text-[var(--color-ink-soft)] transition-all duration-200 hover:bg-[var(--color-paper)]/70 hover:text-[var(--color-ink)]"
                  }
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
