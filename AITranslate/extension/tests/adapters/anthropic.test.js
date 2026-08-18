import { describe, it, expect, vi, afterEach } from "vitest";
import { anthropicAdapter } from "../../src/adapters/anthropic.js";

afterEach(() => vi.restoreAllMocks());

const msgResponse = (text) => ({ ok: true, json: async () => ({ content: [{ type: "text", text }] }) });
const CONFIG = { apiUrl: "https://api.anthropic.com/v1/messages", apiKey: "sk-ant-x", model: "claude-haiku-4-5-20251001" };

describe("anthropic adapter", () => {
  it("batches and parses numbered response with correct headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(msgResponse("1. Hallo\n2. Welt"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await anthropicAdapter.translate(["Hello", "World"], "auto", "de", CONFIG);
    expect(out).toEqual(["Hallo", "Welt"]);
    const req = fetchMock.mock.calls[0];
    expect(req[1].headers["x-api-key"]).toBe("sk-ant-x");
    expect(req[1].headers["anthropic-version"]).toBeTruthy();
    expect(req[1].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });

  it("throws labeled error on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(anthropicAdapter.translate(["x"], "auto", "de", CONFIG)).rejects.toThrow(/401/);
  });
});
