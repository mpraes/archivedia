import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { todayInTimezone } from "./day-range";
import { todayDateString } from "./format";

describe("format", () => {
  const originalTz = process.env.NEXT_PUBLIC_APP_TIMEZONE;

  beforeEach(() => {
    // Pin a deterministic timezone so the test does not depend on the host.
    process.env.NEXT_PUBLIC_APP_TIMEZONE = "UTC";
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
