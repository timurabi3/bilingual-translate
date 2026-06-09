const MARK = "data-xlate";
const ORIG_MARK = "data-xlate-orig";

export function injectTranslation(originalEl, translatedText) {
  if (originalEl.hasAttribute(ORIG_MARK)) return; // already has a translation sibling
  originalEl.setAttribute(ORIG_MARK, "1");
  const node = originalEl.ownerDocument.createElement(originalEl.tagName === "LI" ? "span" : "div");
  node.setAttribute(MARK, "1");
  node.className = "xlate-translation";
  node.textContent = translatedText;
  originalEl.after(node);
}

export function removeAllTranslations(rootEl) {
  rootEl.querySelectorAll(`[${MARK}]`).forEach((n) => n.remove());
  rootEl.querySelectorAll(`[${ORIG_MARK}]`).forEach((n) => {
    n.removeAttribute(ORIG_MARK);
    n.classList.remove("xlate-hidden-original");
  });
}

export function setDisplayMode(rootEl, mode) {
  const origs = rootEl.querySelectorAll(`[${ORIG_MARK}]`);
  const xlates = rootEl.querySelectorAll(`[${MARK}]`);
  origs.forEach((n) => n.classList.toggle("xlate-hidden-original", mode === "translation"));
  xlates.forEach((n) => (n.style.display = mode === "original" ? "none" : ""));
}
