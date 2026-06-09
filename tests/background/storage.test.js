import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../../src/background/storage.js";

function fakeBrowser() {
  let store = {};
  return {
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          if (keys == null) return { ...store };
          const out = {};
          for (const k of [].concat(keys)) if (k in store) out[k] = store[k];
          return out;
        }),
        set: vi.fn(async (obj) => { store = { ...store, ...obj }; }),
      },
    },
  };
}

beforeEach(() => { vi.stubGlobal("browser", fakeBrowser()); });

describe("storage", () => {
  it("returns defaults when storage is empty", async () => {
    const s = await loadSettings();
    expect(s.targetLang).toBe(DEFAULT_SETTINGS.targetLang);
    expect(s.displayMode).toBe("bilingual");
    expect(s.providers.some((p) => p.adapter === "keyless")).toBe(true);
    expect(s.defaultProviderId).toBeTruthy();
  });

  it("round-trips saved settings", async () => {
    await saveSettings({ targetLang: "fr" });
    const s = await loadSettings();
    expect(s.targetLang).toBe("fr");
    // unspecified fields keep defaults
    expect(s.displayMode).toBe("bilingual");
  });
});
