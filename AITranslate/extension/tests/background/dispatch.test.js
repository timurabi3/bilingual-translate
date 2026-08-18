import { describe, it, expect, vi } from "vitest";
import { createDispatcher } from "../../src/background/dispatch.js";

const settings = {
  providers: [{ id: "p1", name: "Test", adapter: "openai-compat", apiUrl: "u", apiKey: "k", model: "m", enabled: true }],
  defaultProviderId: "p1",
  sourceLang: "auto",
  targetLang: "de",
};

describe("dispatcher", () => {
  it("calls the adapter and returns translations", async () => {
    const fakeAdapter = { translate: vi.fn(async (blocks) => blocks.map((b) => b.toUpperCase())) };
    const getAdapter = () => fakeAdapter;
    const d = createDispatcher({ getAdapter, getSettings: async () => settings });

    const out = await d.translateBlocks({ blocks: ["a", "b"], sourceLang: "auto", targetLang: "de" });
    expect(out).toEqual(["A", "B"]);
    expect(fakeAdapter.translate).toHaveBeenCalledOnce();
  });

  it("serves repeated strings from cache without a second adapter call", async () => {
    const fakeAdapter = { translate: vi.fn(async (blocks) => blocks.map((b) => b + "!")) };
    const d = createDispatcher({ getAdapter: () => fakeAdapter, getSettings: async () => settings });

    await d.translateBlocks({ blocks: ["x"], sourceLang: "auto", targetLang: "de" });
    const out = await d.translateBlocks({ blocks: ["x"], sourceLang: "auto", targetLang: "de" });
    expect(out).toEqual(["x!"]);
    // "x" already cached -> adapter only called once total, with the unique block.
    expect(fakeAdapter.translate).toHaveBeenCalledOnce();
  });

  it("throws a clear error when the chosen LLM provider has no key", async () => {
    const noKey = {
      providers: [{ id: "p1", name: "T", adapter: "openai-compat", apiUrl: "u", apiKey: "", model: "m", enabled: true }],
      defaultProviderId: "p1",
    };
    const d = createDispatcher({ getAdapter: () => ({ translate: vi.fn() }), getSettings: async () => noKey });
    await expect(d.translateBlocks({ blocks: ["x"], sourceLang: "auto", targetLang: "de" }))
      .rejects.toThrow(/key/i);
  });

  it("defaults target/source language from settings when omitted", async () => {
    const fakeAdapter = { translate: vi.fn(async (blocks) => blocks.map((b) => b + "_x")) };
    const d = createDispatcher({ getAdapter: () => fakeAdapter, getSettings: async () => settings });

    const out = await d.translateBlocks({ blocks: ["sel"] }); // no langs supplied
    expect(out).toEqual(["sel_x"]);
    const [, srcArg, tgtArg] = fakeAdapter.translate.mock.calls[0];
    expect(srcArg).toBe("auto");
    expect(tgtArg).toBe("de");
  });
});
