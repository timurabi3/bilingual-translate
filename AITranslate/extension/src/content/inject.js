const MARK = "data-xlate";
const ORIG_MARK = "data-xlate-orig";

const INLINE_DISPLAYS = new Set(["inline", "inline-block", "inline-flex", "inline-grid", "contents", "ruby"]);

// Inherently inline-flow tags: treated as inline context regardless of computed
// style — appending a span inside them is always DOM-valid and layout-safe,
// while a block sibling next to a styled link/button rarely is.
const INLINE_TAGS = new Set(["A", "SPAN", "B", "I", "EM", "STRONG", "U", "SMALL", "LABEL", "BUTTON", "SUP", "SUB", "MARK", "FONT", "ABBR", "CITE", "Q", "TIME"]);

// Elements whose parents only allow specific children (tr>td, ul>li, …) — a
// sibling translation would be invalid HTML, so it goes inside instead.
const APPEND_INSIDE = new Set(["LI", "TD", "TH", "DT", "DD", "CAPTION", "FIGCAPTION", "SUMMARY", "OPTION"]);

function computedDisplay(el) {
  const win = el.ownerDocument.defaultView;
  if (!win || typeof win.getComputedStyle !== "function") return "block";
  return win.getComputedStyle(el).display;
}

// In these contexts a block sibling would distort the layout (it becomes a new
// flex/grid item or breaks an inline flow) — Taobao/Weidian headers and navs
// are exactly this. The translation is appended inside as an inline span.
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

export function injectTranslation(originalEl, translatedText) {
  if (originalEl.hasAttribute(ORIG_MARK)) return; // already translated
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

export function removeAllTranslations(rootEl) {
  rootEl.querySelectorAll(`[${MARK}]`).forEach((n) => n.remove());
  rootEl.querySelectorAll(`[${ORIG_MARK}]`).forEach((n) => {
    n.removeAttribute(ORIG_MARK);
    n.classList.remove("xlate-hidden-original");
  });
}

export function setDisplayMode(rootEl, mode) {
  rootEl.querySelectorAll(`[${ORIG_MARK}]`).forEach((orig) => {
    // Only originals with a *sibling* translation can be hidden — for inline
    // injections the translation lives inside the original, so hiding the
    // original would hide the translation with it.
    const sib = orig.nextElementSibling;
    const hidable = sib && sib.hasAttribute(MARK);
    orig.classList.toggle("xlate-hidden-original", mode === "translation" && !!hidable);
  });
  rootEl.querySelectorAll(`[${MARK}]`).forEach((n) => {
    n.style.display = mode === "original" ? "none" : "";
  });
}
