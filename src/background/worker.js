import { getAdapter } from "../adapters/registry.js";
import { loadSettings, saveSettings } from "./storage.js";
import { createDispatcher } from "./dispatch.js";
import { MSG } from "../common/messages.js";

const dispatcher = createDispatcher({ getAdapter, getSettings: loadSettings });

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case MSG.TRANSLATE_BLOCKS:
      try {
        const translations = await dispatcher.translateBlocks(msg.payload);
        return { ok: true, translations };
      } catch (e) {
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
