import { describe, it, expect, vi, afterEach } from "vitest";
import { keylessAdapter } from "../../src/adapters/keyless.js";

afterEach(() => vi.restoreAllMocks());

describe("keyless adapter", () => {
  it("translates each block and returns same-length array", async () => {
    // Google's response shape: [[["Hallo","Hello",...]], ...]
    const fakeResponse = (translated) => ({
      ok: true,
      json: async () => [[[translated, "src", null, null]]],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("Hallo"))
      .mockResolvedValueOnce(fakeResponse("Welt"));
    vi.stubGlobal("fetch", fetchMock);

    const out = await keylessAdapter.translate(["Hello", "World"], "auto", "de", {});
    expect(out).toEqual(["Hallo", "Welt"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("tl=de");
    expect(fetchMock.mock.calls[0][0]).toContain("sl=auto");
  });

  it("throws a labeled error on HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(keylessAdapter.translate(["x"], "auto", "de", {})).rejects.toThrow(/429/);
  });
});
