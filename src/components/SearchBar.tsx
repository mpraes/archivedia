"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  initialQuery?: string;
}

/**
 * Inline search field that pushes `?q=<value>` to the current page when
 * submitted. Empty submission clears the search by navigating to `/`.
 *
 * The submit handler is the canonical action — Enter inside the input
 * also triggers it. We intentionally avoid firing on every keystroke to
 * keep the URL stable for back/forward navigation and to avoid hammering
 * the server during fast typing.
 */
export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external state (e.g. after router.refresh) into the local field.
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const submit = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (trimmed.length === 0) {
        router.push("/");
      } else {
        router.push(`/?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [router],
  );

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit(value);
    },
    [submit, value],
  );

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="flex w-full max-w-sm min-w-0 items-center gap-2"
    >
      <label htmlFor="search-input" className="sr-only">
        {t("label")}
      </label>
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("placeholder")}
        className={`w-full rounded-full border border-[var(--color-line)] bg-surface px-4 py-1.5 text-sm text-[var(--color-ink)] shadow-[inset_3px_0_0_transparent] transition-colors placeholder:text-[var(--color-ink-soft)]/70 focus:border-[var(--color-accent)] focus:bg-surface ${
          value.trim()
            ? "border-[var(--color-accent)]/60 shadow-[inset_3px_0_0_var(--color-accent)]"
            : ""
        }`}
      />
      <button
        type="submit"
        aria-label={t("submit")}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-surface px-2.5 py-1.5 text-sm text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/40"
      >
        <span aria-hidden="true">⌕</span>
      </button>
    </form>
  );
}
