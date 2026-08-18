import { describe, it, expect, vi, afterEach } from "vitest";
import { openaiCompatAdapter } from "../../src/adapters/openaiCompat.js";

afterEach(() => vi.restoreAllMocks());

const chatResponse = (content) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

const CONFIG = { apiUrl: "https://api.deepseek.com/chat/completions", apiKey: "sk-x", model: "deepseek-chat" };

describe("openai-compat adapter", () => {
  it("batches blocks into one call and parses numbered response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("1. Hallo\n2. Welt"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await openaiCompatAdapter.translate(["Hello", "World"], "auto", "de", CONFIG);
    expect(out).toEqual(["Hallo", "Welt"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const req = fetchMock.mock.calls[0];
    expect(req[0]).toBe(CONFIG.apiUrl);
    expect(req[1].headers.Authorization).toBe("Bearer sk-x");
    const body = JSON.parse(req[1].body);
    expect(body.model).toBe("deepseek-chat");
  });

  it("falls back to per-block requests when batch count mismatches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse("1. Hallo")) // wrong count for 2 blocks
      .mockResolvedValueOnce(chatResponse("Hallo")) // per-block retry 1
      .mockResolvedValueOnce(chatResponse("Welt")); // per-block retry 2
    vi.stubGlobal("fetch", fetchMock);

    const out = await openaiCompatAdapter.translate(["Hello", "World"], "auto", "de", CONFIG);
    expect(out).toEqual(["Hallo", "Welt"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws labeled error on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(openaiCompatAdapter.translate(["x"], "auto", "de", CONFIG)).rejects.toThrow(/401/);
  });
});
