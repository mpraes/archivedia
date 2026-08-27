import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { todayInTimezone } from "./day-range";
import {
  REVIEW_THRESHOLD_HOURS,
  agingLabel,
  daysBetween,
  hoursWaitingSince,
  isNeedingReview,
  requiresReview,
  reviewGate,
  todayDateString,
} from "./format";

// Pin a deterministic timezone for every block in this file. The helpers
// rely on getConfiguredTimezone() which reads from process.env at call
// time; without this hook Vitest would resolve an undefined IANA zone.
const PINNED_TZ = "UTC";

describe("format", () => {
  const originalTz = process.env.NEXT_PUBLIC_APP_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = PINNED_TZ;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = originalTz;
  });

  // Regression: todayDateString() used to delegate to formatLocalDate(),
  // which renders in the active locale (e.g. "24/08/2026" for pt-BR) and
  // broke the regex in list-daily-notes.service.ts that requires YYYY-MM-DD.
  it("todayDateString returns YYYY-MM-DD", () => {
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("todayDateString agrees with todayInTimezone for the same timezone", () => {
    const tz = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "UTC";
    expect(todayDateString()).toBe(todayInTimezone(tz));
  });
});

describe("daysBetween", () => {
  const originalTz = process.env.NEXT_PUBLIC_APP_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = PINNED_TZ;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = originalTz;
  });

  // "now" pinned at 2026-08-26 12:00 UTC.
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("returns 0 for the same calendar day", () => {
    expect(daysBetween("2026-08-26T03:00:00.000Z", now)).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysBetween("2026-08-25T23:59:00.000Z", now)).toBe(1);
  });

  it("returns positive N for N days in the past", () => {
    expect(daysBetween("2026-08-24T12:00:00.000Z", now)).toBe(2);
    expect(daysBetween("2026-08-22T12:00:00.000Z", now)).toBe(4);
  });

  it("returns 0 for a timestamp in the future", () => {
    expect(daysBetween("2026-08-27T12:00:00.000Z", now)).toBeLessThanOrEqual(0);
  });
});

describe("agingLabel", () => {
  const originalTz = process.env.NEXT_PUBLIC_APP_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = PINNED_TZ;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = originalTz;
  });

  const now = new Date("2026-08-26T12:00:00.000Z");

  it("returns 'today' for the same day", () => {
    expect(agingLabel("2026-08-26T05:00:00.000Z", now)).toEqual({ kind: "today" });
  });

  it("returns 'yesterday' for one day before", () => {
    expect(agingLabel("2026-08-25T22:00:00.000Z", now)).toEqual({
      kind: "yesterday",
    });
  });

  it("returns 'days_ago' for two or more days before", () => {
    expect(agingLabel("2026-08-24T12:00:00.000Z", now)).toEqual({
      kind: "days_ago",
      count: 2,
    });
  });
});

describe("isNeedingReview", () => {
  const originalTz = process.env.NEXT_PUBLIC_APP_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = PINNED_TZ;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_TIMEZONE = originalTz;
  });

  const now = new Date("2026-08-26T12:00:00.000Z");

  it("flags notes captured two days ago or earlier", () => {
    expect(isNeedingReview("2026-08-24T12:00:00.000Z", now)).toBe(true);
    expect(isNeedingReview("2026-08-22T12:00:00.000Z", now)).toBe(true);
  });

  it("does not flag notes captured today or yesterday", () => {
    expect(isNeedingReview("2026-08-26T05:00:00.000Z", now)).toBe(false);
    expect(isNeedingReview("2026-08-25T22:00:00.000Z", now)).toBe(false);
  });
});

describe("reviewGate + requiresReview", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("exposes the 48-hour threshold as a constant", () => {
    expect(REVIEW_THRESHOLD_HOURS).toBe(48);
  });

  it("computes the earliest eligible createdAt as now - 48h", () => {
    const gate = reviewGate(now);
    expect(gate.now).toBe(now);
    expect(gate.earliestCreatedAt.toISOString()).toBe(
      new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("flags only inbox notes older than 48h with no future postpone", () => {
    const eligible = {
      status: "inbox" as const,
      createdAt: new Date("2026-08-24T10:00:00.000Z"),
      nextReviewAt: null,
      deletedAt: null,
    };
    expect(requiresReview(eligible, now)).toBe(true);
  });

  it("excludes notes that are still fresh (under 48h)", () => {
    const fresh = {
      status: "inbox" as const,
      createdAt: new Date("2026-08-25T20:00:00.000Z"),
      nextReviewAt: null,
      deletedAt: null,
    };
    expect(requiresReview(fresh, now)).toBe(false);
  });

  it("excludes permanent and deleted notes", () => {
    const base = {
      createdAt: new Date("2026-08-24T10:00:00.000Z"),
      nextReviewAt: null,
      deletedAt: null,
    };
    expect(requiresReview({ ...base, status: "permanent" }, now)).toBe(false);
    expect(
      requiresReview(
        { ...base, status: "deleted", deletedAt: new Date(now.getTime() - 1000) },
        now,
      ),
    ).toBe(false);
  });

  it("excludes inbox notes whose nextReviewAt is still in the future", () => {
    const postponed = {
      status: "inbox" as const,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      nextReviewAt: new Date("2026-08-27T10:00:00.000Z"),
      deletedAt: null,
    };
    expect(requiresReview(postponed, now)).toBe(false);
    // Once `now` passes the postpone deadline, the note becomes eligible again.
    expect(
      requiresReview(postponed, new Date("2026-08-28T10:00:00.000Z")),
    ).toBe(true);
  });
});

describe("hoursWaitingSince", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("rounds down to whole hours", () => {
    expect(hoursWaitingSince(new Date("2026-08-25T13:30:00.000Z"), now)).toBe(22);
  });

  it("clamps future timestamps to zero", () => {
    expect(hoursWaitingSince(new Date("2026-08-27T12:00:00.000Z"), now)).toBe(0);
  });
});
