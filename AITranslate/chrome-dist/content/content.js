globalThis.browser ??= globalThis.chrome;

(() => {
  // src/segment/skipRules.js
  var SKIP_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "SVG", "CANVAS"]);
  function shouldSkip(node) {
    if (!node || node.nodeType !== 1) return true;
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node.isContentEditable || node.getAttribute("contenteditable") === "true") return true;
    if (node.hasAttribute("data-xlate")) return true;
    const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return true;
    return false;
  }
  function isPriceOrSymbolOnly(text) {
    const t = (text || "").trim();
    if (!t) return true;
    return !new RegExp("\\p{L}", "u").test(t);
  }

  // src/segment/segmenter.js
  var MAX_BLOCK_LENGTH = 5e3;
  function ownText(node) {
    let s = "";
    for (const child of node.childNodes) {
      if (child.nodeType === 3) s += child.nodeValue;
    }
    return s.trim();
  }
  function hasTextElementChild(node) {
    for (const child of node.children) {
      if (shouldSkip(child)) continue;
      if (child.textContent && child.textContent.trim()) return true;
    }
    return false;
  }
  var INLINE_FORMATTING = /* @__PURE__ */ new Set(["SPAN", "B", "I", "EM", "STRONG", "U", "SMALL", "SUP", "SUB", "MARK", "FONT", "ABBR", "BDI", "BDO", "RUBY", "RT"]);
  var MERGE_MAX_LENGTH = 300;
  function onlyFormattingChildren(node) {
    let any = false;
    for (const child of node.children) {
      if (shouldSkip(child)) continue;
      if (!child.textContent || !child.textContent.trim()) continue;
      if (!INLINE_FORMATTING.has(child.tagName)) return false;
      if (child.children.length > 0 && !onlyFormattingChildren(child)) return false;
      any = true;
    }
    return any;
  }
  function pushBlock(blocks, el) {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text || text.length > MAX_BLOCK_LENGTH) return;
    if (isPriceOrSymbolOnly(text)) return;
    blocks.push({ el, text });
  }
  function collect(node, blocks) {
    if (shouldSkip(node)) return;
    const full = node.textContent;
    if (!full || !full.trim()) return;
    if (ownText(node)) {
      pushBlock(blocks, node);
      return;
    }
    if (full.trim().length <= MERGE_MAX_LENGTH && onlyFormattingChildren(node)) {
      pushBlock(blocks, node);
      return;
    }
    if (hasTextElementChild(node)) {
      for (const child of node.children) collect(child, blocks);
      return;
    }
    pushBlock(blocks, node);
  }
  function collectBlocks(rootEl) {
    const blocks = [];
    collect(rootEl, blocks);
    return blocks;
  }

  // src/content/inject.js
  var MARK = "data-xlate";
  var ORIG_MARK = "data-xlate-orig";
  var INLINE_DISPLAYS = /* @__PURE__ */ new Set(["inline", "inline-block", "inline-flex", "inline-grid", "contents", "ruby"]);
  var INLINE_TAGS = /* @__PURE__ */ new Set(["A", "SPAN", "B", "I", "EM", "STRONG", "U", "SMALL", "LABEL", "BUTTON", "SUP", "SUB", "MARK", "FONT", "ABBR", "CITE", "Q", "TIME"]);
  var APPEND_INSIDE = /* @__PURE__ */ new Set(["LI", "TD", "TH", "DT", "DD", "CAPTION", "FIGCAPTION", "SUMMARY", "OPTION"]);
  function computedDisplay(el) {
    const win = el.ownerDocument.defaultView;
    if (!win || typeof win.getComputedStyle !== "function") return "block";
    return win.getComputedStyle(el).display;
  }
  function isInlineContext(el) {
    if (INLINE_TAGS.has(el.tagName)) return true;
    if (INLINE_DISPLAYS.has(computedDisplay(el))) return true;
    const parent = el.parentElement;
    if (parent) {
      const pd = computedDisplay(parent);
      if (pd === "flex" || pd === "inline-flex" || pd === "grid" || pd === "inline-grid") return true;
    }
    return false;
  }
  function injectTranslation(originalEl, translatedText) {
    if (originalEl.hasAttribute(ORIG_MARK)) return;
    originalEl.setAttribute(ORIG_MARK, "1");
    const doc = originalEl.ownerDocument;
    if (isInlineContext(originalEl)) {
      const span = doc.createElement("span");
      span.setAttribute(MARK, "1");
      span.className = "xlate-translation xlate-inline";
      span.textContent = translatedText;
      originalEl.appendChild(span);
      return;
    }
    const node = doc.createElement("div");
    node.setAttribute(MARK, "1");
    node.className = "xlate-translation xlate-block";
    node.textContent = translatedText;
    if (APPEND_INSIDE.has(originalEl.tagName)) originalEl.appendChild(node);
    else originalEl.after(node);
  }
  function removeAllTranslations(rootEl) {
    rootEl.querySelectorAll(`[${MARK}]`).forEach((n) => n.remove());
    rootEl.querySelectorAll(`[${ORIG_MARK}]`).forEach((n) => {
      n.removeAttribute(ORIG_MARK);
      n.classList.remove("xlate-hidden-original");
    });
  }
  function setDisplayMode(rootEl, mode) {
    rootEl.querySelectorAll(`[${ORIG_MARK}]`).forEach((orig) => {
      const sib = orig.nextElementSibling;
      const hidable = sib && sib.hasAttribute(MARK);
      orig.classList.toggle("xlate-hidden-original", mode === "translation" && !!hidable);
    });
    rootEl.querySelectorAll(`[${MARK}]`).forEach((n) => {
      n.style.display = mode === "original" ? "none" : "";
    });
  }

  // src/common/messages.js
  var MSG = {
    TRANSLATE_BLOCKS: "TRANSLATE_BLOCKS",
    // content -> background: {blocks, sourceLang, targetLang, providerId}
    TRANSLATE_RESULT: "TRANSLATE_RESULT",
    GET_SETTINGS: "GET_SETTINGS",
    SAVE_SETTINGS: "SAVE_SETTINGS",
    TEST_PROVIDER: "TEST_PROVIDER",
    // settings -> background: {provider}
    TRIGGER_TRANSLATE: "TRIGGER_TRANSLATE",
    // popup -> content
    SET_DISPLAY_MODE: "SET_DISPLAY_MODE"
  };

  // src/common/domains.js
  function domainMatches(hostname, domain) {
    const h = String(hostname || "").toLowerCase();
    const d = String(domain || "").toLowerCase().replace(/^\.+/, "").trim();
    if (!d) return false;
    return h === d || h.endsWith("." + d);
  }

  // src/content/content.js
  var BATCH = 20;
  var translating = false;
  async function requestTranslate(texts, sourceLang, targetLang) {
    const res = await browser.runtime.sendMessage({
      type: MSG.TRANSLATE_BLOCKS,
      payload: { blocks: texts, sourceLang, targetLang }
    });
    if (!res.ok) throw new Error(res.error);
    return res.translations;
  }
  function viewportDistance(el) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0) return Math.abs(r.bottom) + 1e5;
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
      const blocks = collectBlocks(document.body).filter((b) => !b.el.hasAttribute("data-xlate-orig")).sort((a, b) => viewportDistance(a.el) - viewportDistance(b.el));
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
    warn.textContent = " \u26A0";
    warn.title = reason;
    el.after(warn);
  }
  var observer = null;
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
  (async () => {
    try {
      const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
      const s = res && res.settings;
      if (!s || !Array.isArray(s.autoTranslateDomains) || s.autoTranslateDomains.length === 0) return;
      if (s.autoTranslateDomains.some((d) => domainMatches(location.hostname, d))) {
        await translatePage({ sourceLang: s.sourceLang, targetLang: s.targetLang });
      }
    } catch {
    }
  })();
})();
