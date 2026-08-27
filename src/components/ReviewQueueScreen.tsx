"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReviewQueueItemDto } from "@/lib/api";
import { displayPreview } from "@/lib/format";

interface ReviewQueueScreenProps {
  total: number;
  /** Up to 5 oldest items, used as a peek so the page is informative
   *  even before the user clicks "Start review". */
  firstItems: ReviewQueueItemDto[];
}

export function ReviewQueueScreen({ total, firstItems }: ReviewQueueScreenProps) {
  const t = useTranslations("review");
  const isEmpty = total === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[74.88rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
          {t("title")}
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-3xl text-[var(--color-ink)]">
          {t("intro_heading")}
        </h1>
      </header>

      <section
        aria-labelledby="queue-status"
        className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
      >
        <h2 id="queue-status" className="sr-only">
          {t("intro_heading")}
        </h2>
        {isEmpty ? (
          <div className="py-6 text-center">
            <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
              {t("queue_empty_title")}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              {t("queue_empty_description")}
            </p>
          </div>
        ) : (
          <>
            <p className="text-base text-[var(--color-ink)]">
              {t("ready_count_one", { count: total })}
            </p>
            <div className="mt-5">
              <Link
                href="/review/start"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-accent)]/90"
              >
                {t("start_button")}
              </Link>
            </div>
          </>
        )}
      </section>

      {!isEmpty && firstItems.length > 0 ? (
        <section
          aria-labelledby="queue-peek"
          className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7"
        >
          <h2
            id="queue-peek"
            className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]"
          >
            {t("waiting_label")}
          </h2>
          <ol className="mt-4 divide-y divide-[var(--color-line)]/60">
            {firstItems.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/notes/${encodeURIComponent(item.id)}`}
                  className="block rounded-md px-3 py-2 transition hover:bg-surface-soft"
                >
                  <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">
                    {displayPreview(item.content, 160)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                    {t("waiting_days_one", {
                      count: Math.max(1, Math.floor(item.waitingSinceHours / 24)),
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
