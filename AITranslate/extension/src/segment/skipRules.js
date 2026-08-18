const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "SVG", "CANVAS"]);

export function shouldSkip(node) {
  if (!node || node.nodeType !== 1) return true; // not an element
  if (SKIP_TAGS.has(node.tagName)) return true;
  if (node.isContentEditable || node.getAttribute("contenteditable") === "true") return true;
  if (node.hasAttribute("data-xlate")) return true; // our own injected/processed nodes
  const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return true;
  return false;
}

// True when a string has no letters worth translating (prices, numbers, symbols).
export function isPriceOrSymbolOnly(text) {
  const t = (text || "").trim();
  if (!t) return true;
  // \p{L} = any kind of letter in any language (incl. CJK). No letters => skip.
  return !/\p{L}/u.test(t);
}
