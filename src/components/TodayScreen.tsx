"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { NoteDto } from "@/lib/note-dto";
import type { NoteStatus } from "@/domain/note-status";
import { CaptureForm } from "./CaptureForm";
import { DateNav } from "./DateNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NoteList } from "./NoteList";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

interface TodayScreenProps {
  date: string;
  today: string;
  timezone: string;
  initialNotes: NoteDto[];
  activeFilters: {
    q?: string;
    status?: NoteStatus;
    tag?: string;
  };
}

export function TodayScreen({
  date,
  today,
  timezone,
  initialNotes,
  activeFilters,
}: TodayScreenProps) {
  const t = useTranslations("today");
  const tFilters = useTranslations("filters");
  const tSearch = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();

  // FR-13: revalidate the server-rendered list without reloading the page.
  const refresh = useCallback(() => router.refresh(), [router]);

  const isSearching = Boolean(activeFilters.q);
  const isPermanent = activeFilters.status === "permanent";
  const isTagged = Boolean(activeFilters.tag);

  const heading = isSearching
    ? tSearch("results_label")
    : isPermanent
      ? tFilters("permanent")
      : isTagged
        ? tFilters("tag_label")
        : date === today
          ? t("label_today")
          : t("label_viewing");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar initialQuery={activeFilters.q ?? ""} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      {!isSearching ? <CaptureForm onSaved={refresh} /> : null}

      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            {heading}
          </p>
          <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
            {isSearching
              ? tSearch("count", { count: initialNotes.length })
              : isPermanent || isTagged
                ? tSearch("count", { count: initialNotes.length })
                : formatLongDate(`${date}T12:00:00Z`, locale)}
          </h2>
        </div>
        {!isSearching && !isPermanent && !isTagged ? (
          <DateNav date={date} todayDate={today} />
        ) : null}
      </section>

      <ActiveFilters filters={activeFilters} />

      {initialNotes.length === 0 ? (
        <EmptyState
          date={date}
          today={today}
          timezone={timezone}
          searching={isSearching}
        />
      ) : (
        <NoteList notes={initialNotes} />
      )}
    </main>
  );
}

function ActiveFilters({
  filters,
}: {
  filters: { q?: string; status?: NoteStatus; tag?: string };
}) {
  const tFilters = useTranslations("filters");
  const tSearch = useTranslations("search");
  const chips: { label: string; href: string; clear: string; icon: string }[] = [];

  if (filters.q) {
    chips.push({
      label: `“${filters.q}”`,
      href: "/",
      clear: tSearch("clear"),
      icon: "⌕",
    });
  }
  if (filters.status === "permanent") {
    chips.push({
      label: tFilters("permanent"),
      href: "/",
      clear: tFilters("tag_clear"),
      icon: "⊞",
    });
  }
  if (filters.tag) {
    chips.push({
      label: `#${filters.tag}`,
      href: "/",
      clear: tFilters("tag_clear"),
      icon: "#",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <a
          key={chip.label}
          href={chip.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)]/60 bg-surface px-3 py-1 text-xs text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/40"
        >
          <span aria-hidden="true">{chip.icon}</span>
          <span>{chip.label}</span>
          <span aria-hidden="true">×</span>
          <span className="sr-only">{chip.clear}</span>
        </a>
      ))}
    </div>
  );
}

function EmptyState({
  date,
  today,
  timezone,
  searching,
}: {
  date: string;
  today: string;
  timezone: string;
  searching: boolean;
}) {
  const t = useTranslations("today");
  const tSearch = useTranslations("search");
  const label = searching
    ? tSearch("empty")
    : date === today
      ? t("empty_today")
      : t("empty_other");
  return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft px-6 py-10 text-center">
      <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">{label}</p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
        {timezone}
      </p>
    </div>
  );
}

function formatLongDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
