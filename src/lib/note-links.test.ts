import { describe, expect, it } from "vitest";
import { extractLinkedNoteIds, normaliseTags } from "./note-links";

describe("extractLinkedNoteIds", () => {
  it("returns an empty array for content without links", () => {
    expect(extractLinkedNoteIds("")).toEqual([]);
    expect(extractLinkedNoteIds("just a thought")).toEqual([]);
  });

  it("captures a single publicId", () => {
    expect(extractLinkedNoteIds("see [[20260824-1132-001]]")).toEqual(["20260824-1132-001"]);
  });

  it("captures and dedupes multiple links", () => {
    expect(
      extractLinkedNoteIds("[[20260824-1132-001]] and [[20260824-1132-001]]"),
    ).toEqual(["20260824-1132-001"]);
    expect(
      extractLinkedNoteIds("[[a]] [[b]] [[a]] [[c]]"),
    ).toEqual(["a", "b", "c"]);
  });

  it("normalises whitespace inside the brackets", () => {
    expect(extractLinkedNoteIds("[[   spaced out  ]]")).toEqual(["spaced out"]);
    expect(extractLinkedNoteIds("[[\t tabs \t]]")).toEqual(["tabs"]);
  });

  it("ignores malformed brackets", () => {
    expect(extractLinkedNoteIds("[single]")).toEqual([]);
    expect(extractLinkedNoteIds("[[unclosed")).toEqual([]);
    expect(extractLinkedNoteIds("]wrong[")).toEqual([]);
  });

  it("ignores newlines inside brackets (broken pattern)", () => {
    expect(extractLinkedNoteIds("[[broken\nlink]]")).toEqual([]);
  });
});

describe("normaliseTags", () => {
  it("returns an empty array for undefined/null/empty", () => {
    expect(normaliseTags(undefined)).toEqual([]);
    expect(normaliseTags(null)).toEqual([]);
    expect(normaliseTags([])).toEqual([]);
  });

  it("trims, lowercases, and dedupes tags", () => {
    expect(normaliseTags(["  Work ", "work", "PERSONAL", "personal"])).toEqual([
      "work",
      "personal",
    ]);
  });

  it("filters out empty and oversize tags", () => {
    expect(normaliseTags(["", "   ", "a".repeat(33), "ok"])).toEqual(["ok"]);
  });

  it("preserves first-seen order", () => {
    expect(normaliseTags(["zeta", "alpha", "beta", "ALPHA"])).toEqual([
      "zeta",
      "alpha",
      "beta",
    ]);
  });
});
