import { collectBlocks } from "../segment/segmenter.js";
import { injectTranslation, removeAllTranslations, setDisplayMode } from "./inject.js";
import { MSG } from "../common/messages.js";
import { domainMatches } from "../common/domains.js";

const BATCH = 20;

let translating = false;

async function requestTranslate(texts, sourceLang, targetLang) {
  const res = await browser.runtime.sendMessage({
    type: MSG.TRANSLATE_BLOCKS,
    payload: { blocks: texts, sourceLang, targetLang },
  });
  if (!res.ok) throw new Error(res.error);
  return res.translations;
}

// Vertical distance from the top of the viewport. Blocks closest to (or inside)
// the viewport translate first, so a long Taobao page fills in where the user is
// looking instead of top-to-bottom from the page origin.
function viewportDistance(el) {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0) return Math.abs(r.bottom) + 100000; // above viewport, deprioritise
  return Math.max(0, r.top);
}

async function translateBatch(slice, opts) {
  try {
    const translations = await requestTranslate(slice.map((b) => b.text), opts.sourceLang, opts.targetLang);
    slice.forEach((b, j) => {
      if (translations[j]) injectTranslation(b.el, translations[j]);
    });
  } catch (e) {
    slice.forEach((b) => markError(b.el, e.message));
  }
}

async function translatePage({ sourceLang, targetLang }) {
  if (translating) return;
  translating = true;
  try {
    const blocks = collectBlocks(document.body)
      .filter((b) => !b.el.hasAttribute("data-xlate-orig"))
      .sort((a, b) => viewportDistance(a.el) - viewportDistance(b.el));

    for (let i = 0; i < blocks.length; i += BATCH) {
      await translateBatch(blocks.slice(i, i + BATCH), { sourceLang, targetLang });
    }
    observeMutations({ sourceLang, targetLang });
  } finally {
    translating = false;
  }
}

function markError(el, reason) {
  if (el.hasAttribute("data-xlate-orig")) return;
  el.setAttribute("data-xlate-orig", "1");
  const warn = el.ownerDocument.createElement("span");
  warn.setAttribute("data-xlate", "1");
  warn.className = "xlate-error";
  warn.textContent = " ⚠";
  warn.title = reason;
  el.after(warn);
}

let observer = null;
function observeMutations(opts) {
  if (observer) return;
  let pending = [];
  let timer = null;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && !node.hasAttribute("data-xlate")) pending.push(node);
      }
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const roots = pending;
      pending = [];
      const fresh = [];
      for (const r of roots) {
        if (!r.isConnected) continue;
        for (const b of collectBlocks(r)) {
          if (!b.el.hasAttribute("data-xlate-orig")) fresh.push(b);
        }
      }
      if (fresh.length === 0) return;
      for (let i = 0; i < fresh.length; i += BATCH) {
        await translateBatch(fresh.slice(i, i + BATCH), opts);
      }
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === MSG.TRIGGER_TRANSLATE) {
    // Clear previous translations first so switching language actually
    // re-translates instead of leaving stale blocks behind.
    removeAllTranslations(document.body);
    await translatePage(msg.payload);
    return { ok: true };
  }
  if (msg.type === MSG.SET_DISPLAY_MODE) {
    if (msg.payload.mode === "original") removeAllTranslations(document.body);
    else setDisplayMode(document.body, msg.payload.mode);
    return { ok: true };
  }
});

// Auto-translate: pages whose domain is in the settings list translate on load,
// no clicks needed.
(async () => {
  try {
    const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
    const s = res && res.settings;
    if (!s || !Array.isArray(s.autoTranslateDomains) || s.autoTranslateDomains.length === 0) return;
    if (s.autoTranslateDomains.some((d) => domainMatches(location.hostname, d))) {
      await translatePage({ sourceLang: s.sourceLang, targetLang: s.targetLang });
    }
  } catch {
    // Service worker may be restarting; the next load retries.
  }
})();
