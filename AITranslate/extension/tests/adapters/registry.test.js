import { describe, it, expect } from "vitest";
import { getAdapter } from "../../src/adapters/registry.js";
import { PRESETS } from "../../src/presets.js";

describe("registry", () => {
  it("resolves each adapter id to an object with translate()", () => {
    for (const id of ["keyless", "openai-compat", "classic-mt", "anthropic"]) {
      const a = getAdapter(id);
      expect(typeof a.translate).toBe("function");
    }
  });

  it("throws on unknown adapter id", () => {
    expect(() => getAdapter("nope")).toThrow(/unknown adapter/i);
  });
});

describe("presets", () => {
  it("every preset references a valid adapter id", () => {
    for (const p of PRESETS) {
      expect(() => getAdapter(p.adapter)).not.toThrow();
      expect(p.name).toBeTruthy();
    }
  });

  it("includes the keyless default and common providers", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("keyless");
    expect(ids).toContain("openai");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("deepl");
    expect(ids).toContain("anthropic");
  });
});
