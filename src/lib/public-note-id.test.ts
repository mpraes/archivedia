import { describe, expect, it } from "vitest";
import { formatPublicIdStem, generatePublicId, minuteBucket } from "./public-note-id";

describe("public-note-id", () => {
  it("formats the stem using the application timezone", () => {
    // 2026-08-24T14:32:05Z is 11:32 in America/Sao_Paulo (UTC-3).
    const at = new Date("2026-08-24T14:32:05.000Z");
    expect(formatPublicIdStem(at, "America/Sao_Paulo", 1)).toBe("20260824-1132-001");
  });

  it("respects sequence padding to three digits", () => {
    const at = new Date("2026-08-24T14:32:05.000Z");
    expect(formatPublicIdStem(at, "America/Sao_Paulo", 42)).toBe("20260824-1132-042");
    expect(formatPublicIdStem(at, "America/Sao_Paulo", 999)).toBe("20260824-1132-999");
  });

  it("appends a short random tail for collision resistance", () => {
    const at = new Date("2026-08-24T14:32:05.000Z");
    const id = generatePublicId(at, "America/Sao_Paulo", 1);
    expect(id.startsWith("20260824-1132-001-")).toBe(true);
    expect(id.length).toBe("20260824-1132-001-".length + 8);
  });

  it("returns the YYYYMMDD-HHmm minute bucket", () => {
    const at = new Date("2026-08-24T14:32:05.000Z");
    expect(minuteBucket(at, "America/Sao_Paulo")).toBe("20260824-1132");
  });
});
