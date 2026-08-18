import { PRESETS } from "../presets.js";

export const DEFAULT_SETTINGS = {
  // Seed providers: the keyless default is enabled out of the box.
  providers: [{ ...PRESETS[0], enabled: true }],
  defaultProviderId: "keyless",
  sourceLang: "auto",
  targetLang: "de",
  displayMode: "bilingual", // "bilingual" | "original" | "translation"
  autoTranslateDomains: [],
};

const KEY = "settings";

export async function loadSettings() {
  const got = await browser.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(got[KEY] || {}) };
}

export async function saveSettings(partial) {
  const current = await loadSettings();
  const next = { ...current, ...partial };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}
