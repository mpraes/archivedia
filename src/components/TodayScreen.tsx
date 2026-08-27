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
import { ReviewAlert } from "./ReviewAlert";
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
  /** Total inbox notes that have crossed the 48h Review gate (FR-28). */
  reviewReadyCount?: number;
}

export function TodayScreen({
  date,
  today,
  timezone,
  initialNotes,
  activeFilters,
  reviewReadyCount = 0,
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

  const viewingTitle =
    isSearching || isPermanent || isTagged
      ? tSearch("count", { count: initialNotes.length })
      : formatLongDate(`${date}T12:00:00Z`, locale);

  const showNav = !isSearching && !isPermanent && !isTagged;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[74.88rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar initialQuery={activeFilters.q ?? ""} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      {/* FR-28/FR-29: non-blocking review alert. Hidden when there's
          nothing to review, or when searching/permanent/tag views are
          active so the alert never competes with the capture form. */}
      {reviewReadyCount > 0 && !isSearching && !isPermanent && !isTagged ? (
        <ReviewAlert count={reviewReadyCount} />
      ) : null}

      <ActiveFilters filters={activeFilters} />

      {isSearching ? (
        <ViewingCard
          date={date}
          today={today}
          timezone={timezone}
          heading={heading}
          title={viewingTitle}
          showNav={showNav}
          notes={initialNotes}
          searching={isSearching}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
          <CaptureForm onSaved={refresh} />
          <ViewingCard
            date={date}
            today={today}
            timezone={timezone}
            heading={heading}
            title={viewingTitle}
            showNav={showNav}
            notes={initialNotes}
            searching={isSearching}
          />
        </div>
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
  const chips: { label: string; href: string; clear: string; icon: string }[] =
    [];

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

interface ViewingCardProps {
  date: string;
  today: string;
  timezone: string;
  heading: string;
  title: string;
  showNav: boolean;
  notes: NoteDto[];
  searching: boolean;
}

function ViewingCard({
  date,
  today,
  timezone,
  heading,
  title,
  showNav,
  notes,
  searching,
}: ViewingCardProps) {
  return (
    <section
      aria-labelledby="viewing-label"
      className="flex flex-col rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
    >
      <div>
        <p
          id="viewing-label"
          className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]"
        >
          {heading}
        </p>
        <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
          {title}
        </h2>
        {showNav ? (
          <div className="mt-4">
            <DateNav date={date} todayDate={today} />
          </div>
        ) : null}
      </div>

      {/* The list shares the card surface with the header so the right column reads as one panel rather than two stacked boxes. A light top border separates navigation from content without adding another card. */}
      <div className="mt-5 border-t border-[var(--color-line)]/60 pt-5">
        {notes.length === 0 ? (
          <EmptyState
            date={date}
            today={today}
            timezone={timezone}
            searching={searching}
            bordered={false}
          />
        ) : (
          <NoteList notes={notes} />
        )}
      </div>
    </section>
  );
}

function EmptyState({
  date,
  today,
  timezone,
  searching,
  bordered = true,
}: {
  date: string;
  today: string;
  timezone: string;
  searching: boolean;
  bordered?: boolean;
}) {
  const t = useTranslations("today");
  const tSearch = useTranslations("search");
  const label = searching
    ? tSearch("empty")
    : date === today
      ? t("empty_today")
      : t("empty_other");
  // When nested inside the ViewingCard the surrounding surface and border
  // already provide separation, so the inner dashed box would read as a
  // nested card rather than an empty hint.
  const wrapperClasses = bordered
    ? "rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft px-6 py-10 text-center"
    : "py-10 text-center";
  return (
    <div className={wrapperClasses}>
      <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
        {label}
      </p>
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
