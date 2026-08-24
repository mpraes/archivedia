"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { NoteDto } from "@/lib/note-dto";
import { CaptureForm } from "./CaptureForm";
import { DateNav } from "./DateNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NoteList } from "./NoteList";

interface TodayScreenProps {
  date: string;
  today: string;
  timezone: string;
  initialNotes: NoteDto[];
}

export function TodayScreen({ date, today, timezone, initialNotes }: TodayScreenProps) {
  const t = useTranslations("today");
  const locale = useLocale();
  const router = useRouter();

  // FR-13: revalidar a lista renderizada no servidor sem recarregar a página.
  const refresh = useCallback(() => router.refresh(), [router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-end">
        <LanguageSwitcher />
      </div>

      <CaptureForm onSaved={refresh} />

      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            {date === today ? t("label_today") : t("label_viewing")}
          </p>
          <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
            {formatLongDate(`${date}T12:00:00Z`, locale)}
          </h2>
        </div>
        <DateNav date={date} todayDate={today} />
      </section>

      {initialNotes.length === 0 ? (
        <EmptyState date={date} today={today} timezone={timezone} />
      ) : (
        <NoteList notes={initialNotes} />
      )}
    </main>
  );
}

function EmptyState({ date, today, timezone }: { date: string; today: string; timezone: string }) {
  const t = useTranslations("today");
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-white/40 px-6 py-10 text-center">
      <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
        {date === today ? t("empty_today") : t("empty_other")}
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
