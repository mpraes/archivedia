"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const LINK_PATTERN = /\[\[([^\[\]\n]+)\]\]/g;

/**
 * Render note content with `[[publicId]]` references turned into Links.
 *
 * Resolution strategy: every `[[...]]` becomes a Link to `/notes/<token>`.
 * If the token does not resolve on the server, the destination page
 * renders the 404 not-found view, so unresolved links stay navigable.
 *
 * Pure presentation: no state, no fetch. Callers can drop it anywhere a
 * string is normally rendered.
 */
export function LinkifiedText({ content }: { content: string }): ReactNode {
  if (!content) return null;
  const parts: ReactNode[] = [];
  let cursor = 0;
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const token = normaliseToken(match[1]);
    if (!token) continue;
    if (match.index > cursor) {
      parts.push(
        <Fragment key={`t-${key++}`}>{content.slice(cursor, match.index)}</Fragment>,
      );
    }
    parts.push(
      <Link
        key={`l-${key++}`}
        href={`/notes/${encodeURIComponent(token)}`}
        className="rounded-sm bg-[var(--color-accent-soft)]/40 px-1 font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)] decoration-1 underline-offset-4 transition-colors hover:bg-[var(--color-accent-soft)]"
      >
        {token}
      </Link>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < content.length) {
    parts.push(<Fragment key={`t-${key++}`}>{content.slice(cursor)}</Fragment>);
  }
  return parts;
}

function normaliseToken(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
