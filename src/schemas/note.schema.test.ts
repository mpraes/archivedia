import { describe, expect, it } from "vitest";
import { createNoteBodySchema, updateNoteBodySchema } from "./note.schema";

describe("note.schema", () => {
  it("trims and accepts non-empty content", () => {
    const parsed = createNoteBodySchema.parse({ content: "  hello  " });
    expect(parsed.content).toBe("hello");
  });

  it("rejects empty or whitespace-only content", () => {
    expect(() => createNoteBodySchema.parse({ content: "" })).toThrow();
    expect(() => createNoteBodySchema.parse({ content: "   \n\t  " })).toThrow();
  });

  it("rejects missing content", () => {
    expect(() => createNoteBodySchema.parse({})).toThrow();
  });

  it("rejects oversized content", () => {
    expect(() => createNoteBodySchema.parse({ content: "a".repeat(20_001) })).toThrow();
  });

  it("reuses the same rules on update", () => {
    expect(() => updateNoteBodySchema.parse({ content: "   " })).toThrow();
    expect(updateNoteBodySchema.parse({ content: "ok" }).content).toBe("ok");
  });
});
