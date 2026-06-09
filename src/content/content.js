import { collectBlocks } from "../segment/segmenter.js";
import { injectTranslation, removeAllTranslations, setDisplayMode } from "./inject.js";
import { MSG } from "../common/messages.js";

let translating = false;

async function requestTranslate(texts, sourceLang, targetLang) {
  const res = await browser.runtime.sendMessage({
    type: MSG.TRANSLATE_BLOCKS,
    payload: { blocks: texts, sourceLang, targetLang },
  });
  if (!res.ok) throw new Error(res.error);
  return res.translations;
}

async function translatePage({ sourceLang, targetLang }) {
  if (translating) return;
  translating = true;
  try {
    const blocks = collectBlocks(document.body);
    const BATCH = 20;
    for (let i = 0; i < blocks.length; i += BATCH) {
      const slice = blocks.slice(i, i + BATCH);
      try {
        const translations = await requestTranslate(slice.map((b) => b.text), sourceLang, targetLang);
        slice.forEach((b, j) => injectTranslation(b.el, translations[j]));
      } catch (e) {
        slice.forEach((b) => markError(b.el, e.message));
      }
    }
    observeMutations({ sourceLang, targetLang });
  } finally {
    translating = false;
  }
}

function markError(el, reason) {
  if (el.hasAttribute("data-xlate-orig")) return;
  el.setAttribute("data-xlate-orig", "1");
  const warn = document.createElement("span");
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
      const roots = pending; pending = [];
      const fresh = [];
      for (const r of roots) for (const b of collectBlocks(r)) fresh.push(b);
      if (fresh.length === 0) return;
      try {
        const translations = await requestTranslate(fresh.map((b) => b.text), opts.sourceLang, opts.targetLang);
        fresh.forEach((b, j) => injectTranslation(b.el, translations[j]));
      } catch (e) { /* leave untranslated on dynamic error */ }
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === MSG.TRIGGER_TRANSLATE) {
    await translatePage(msg.payload);
    return { ok: true };
  }
  if (msg.type === MSG.SET_DISPLAY_MODE) {
    if (msg.payload.mode === "original") removeAllTranslations(document.body);
    else setDisplayMode(document.body, msg.payload.mode);
    return { ok: true };
  }
});
