"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface ReviewAlertProps {
  /** Total notes waiting in the Review queue (>= 1 to render). */
  count: number;
}

/**
 * FR-28 / FR-29: non-blocking alert banner on the Today page. The
 * server fetches `meta.readyForReview` from the Review queue API and
 * passes the count here. The banner is intentionally dismissible —
 * clicking "Later" hides it for the rest of the session via local
 * state (no persistence yet; the doc only asks for a hide affordance).
 *
 * Visual polish is owned by the designer (separate pass). This file
 * stays behaviour-only so the design can iterate freely.
 */
export function ReviewAlert({ count }: ReviewAlertProps) {
  const t = useTranslations("review");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || count <= 0) return null;

  return (
    <>
      <style>{`
        @keyframes review-alert-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .review-alert-in {
          animation: review-alert-in 0.3s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .review-alert-in {
            animation: none;
          }
        }
      `}</style>
      <aside
        role="status"
        aria-live="polite"
        className="review-alert-in relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.12)] sm:p-5"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-[var(--color-accent)]/80" aria-hidden="true" />
        <div className="flex flex-col gap-4 pl-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-[var(--color-ink)]">
              {t("alert_message_one", { count })}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Link
              href="/review"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-accent)]/90 hover:shadow-md"
            >
              {t("alert_review_now")}
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors duration-200 hover:bg-[var(--color-paper)]/70 hover:text-[var(--color-ink)]"
            >
              {t("alert_later")}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
