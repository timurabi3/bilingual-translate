import { describe, it, expect, vi, afterEach } from "vitest";
import { classicMtAdapter } from "../../src/adapters/classicMt.js";

afterEach(() => vi.restoreAllMocks());

describe("classic-mt adapter (DeepL)", () => {
  const CFG = { apiUrl: "https://api-free.deepl.com/v2/translate", apiKey: "key", variant: "deepl" };

  it("sends DeepL form body and parses translations array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: "Hallo" }, { text: "Welt" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await classicMtAdapter.translate(["Hello", "World"], "auto", "DE", CFG);
    expect(out).toEqual(["Hallo", "Welt"]);
    const req = fetchMock.mock.calls[0];
    expect(req[1].headers.Authorization).toBe("DeepL-Auth-Key key");
    expect(req[1].body).toContain("target_lang=DE");
  });

  it("throws labeled error on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(classicMtAdapter.translate(["x"], "auto", "DE", CFG)).rejects.toThrow(/403/);
  });
});

describe("classic-mt adapter (Google Cloud)", () => {
  const CFG = { apiUrl: "https://translation.googleapis.com/language/translate/v2", apiKey: "gk", variant: "google-cloud" };

  it("parses Google Cloud response shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { translations: [{ translatedText: "Hallo" }] } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await classicMtAdapter.translate(["Hello"], "auto", "de", CFG);
    expect(out).toEqual(["Hallo"]);
    expect(fetchMock.mock.calls[0][0]).toContain("key=gk");
  });
});
