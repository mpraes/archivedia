"use client";

import { useTranslations } from "next-intl";

interface TagChipProps {
  tag: string;
  onRemove?: () => void;
  /** When true, the chip renders as a link/button that filters by tag. */
  filterHref?: string;
}

/**
 * Small pill representing a single tag. Two visual states:
 * - passive: muted, used in lists and the editor preview
 * - filter: accent-tinted, used as a click-to-filter chip
 */
export function TagChip({ tag, onRemove, filterHref }: TagChipProps) {
  const t = useTranslations("note");
  if (filterHref) {
    return (
      <a
        href={filterHref}
        className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-surface px-2.5 py-0.5 text-[11px] tracking-[0.04em] text-[var(--color-ink-soft)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        #{tag}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-surface-soft px-2.5 py-0.5 text-[11px] tracking-[0.04em] text-[var(--color-ink-soft)]">
      <span>#{tag}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("tags_remove", { tag })}
          className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-warn)]/10 hover:text-[var(--color-warn)]"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </span>
  );
}
