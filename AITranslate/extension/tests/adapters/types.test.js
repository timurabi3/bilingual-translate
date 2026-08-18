import { describe, it, expect } from "vitest";
import { buildNumberedPrompt, parseNumberedResponse } from "../../src/adapters/types.js";

describe("numbered prompt batching", () => {
  it("builds a numbered list from blocks", () => {
    const out = buildNumberedPrompt(["Hello", "World"]);
    expect(out).toBe("1. Hello\n2. World");
  });

  it("parses a well-formed numbered response back into an array", () => {
    const parsed = parseNumberedResponse("1. Hallo\n2. Welt", 2);
    expect(parsed).toEqual(["Hallo", "Welt"]);
  });

  it("returns null when block count does not match (signals fallback)", () => {
    const parsed = parseNumberedResponse("1. Hallo", 2);
    expect(parsed).toBeNull();
  });

  it("tolerates extra blank lines and multi-line block text", () => {
    const parsed = parseNumberedResponse("1. Hallo\n\n2. Mehrzeiliger\nText", 2);
    expect(parsed).toEqual(["Hallo", "Mehrzeiliger\nText"]);
  });
});
