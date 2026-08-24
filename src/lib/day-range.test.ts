import { describe, expect, it } from "vitest";
import { AppError } from "@/errors/app-error";
import { assertValidTimezone, dayRangeUtc, parseCalendarDate, todayInTimezone } from "./day-range";

describe("day-range", () => {
  it("parses a valid YYYY-MM-DD date", () => {
    const date = parseCalendarDate("2026-08-24");
    expect(date.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => parseCalendarDate("2026-8-24")).toThrow(AppError);
    expect(() => parseCalendarDate("2026-02-30")).toThrow(AppError);
    expect(() => parseCalendarDate("not-a-date")).toThrow(AppError);
  });

  it("computes the UTC range that covers a local day in the timezone", () => {
    // 2026-08-24 in America/Sao_Paulo spans 03:00 UTC to 03:00 UTC next day.
    const { start, end } = dayRangeUtc("2026-08-24", "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-08-24T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-25T03:00:00.000Z");
  });

  it("rejects unknown timezones", () => {
    expect(() => assertValidTimezone("Atlantis/Lemuria")).toThrow(AppError);
  });

  it("returns today in the configured timezone", () => {
    const tzDate = todayInTimezone("UTC", new Date("2026-08-24T22:00:00.000Z"));
    expect(tzDate).toBe("2026-08-24");
  });
});
