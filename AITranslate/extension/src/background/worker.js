import { getAdapter } from "../adapters/registry.js";
import { loadSettings, saveSettings } from "./storage.js";
import { createDispatcher } from "./dispatch.js";
import { MSG } from "../common/messages.js";

const dispatcher = createDispatcher({ getAdapter, getSettings: loadSettings });

// Toolbar badge: "!" when a translation request failed, cleared on success.
// A silent error count matters more than being pretty.
function setBadge(text) {
  try {
    if (browser.action?.setBadgeText) browser.action.setBadgeText({ text });
    if (browser.action?.setBadgeBackgroundColor && text) {
      browser.action.setBadgeBackgroundColor({ color: "#e0457b" });
    }
  } catch {
    // Badges are cosmetic; never let them break the worker.
  }
}

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case MSG.TRANSLATE_BLOCKS:
      try {
        const translations = await dispatcher.translateBlocks(msg.payload);
        setBadge("");
        return { ok: true, translations };
      } catch (e) {
        setBadge("!");
        return { ok: false, error: String(e.message || e) };
      }
    case MSG.GET_SETTINGS:
      return { ok: true, settings: await loadSettings() };
    case MSG.SAVE_SETTINGS:
      return { ok: true, settings: await saveSettings(msg.payload) };
    case MSG.TEST_PROVIDER:
      try {
        const adapter = getAdapter(msg.payload.adapter);
        const out = await adapter.translate(["Hello world"], "auto", "de", msg.payload);
        return { ok: true, sample: out[0] };
      } catch (e) {
        return { ok: false, error: String(e.message || e) };
      }
    default:
      return { ok: false, error: `Unknown message type: ${msg.type}` };
  }
});

// Keyboard shortcut (Alt+A / ⌥A, rebindable in chrome://extensions/shortcuts).
// The popup's Translate button shows the same ⌥A kbd.
if (browser.commands?.onCommand) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "translate-page") return;
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null) return;
      // Empty payload: content script falls back to the saved languages.
      await browser.tabs.sendMessage(tab.id, { type: MSG.TRIGGER_TRANSLATE, payload: {} });
    } catch {
      // No content script (chrome:// pages, Web Store, …) — nothing to do.
    }
  });
}
