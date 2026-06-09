import { shouldSkip, isPriceOrSymbolOnly } from "./skipRules.js";

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH", "BLOCKQUOTE", "DD", "DT", "FIGCAPTION", "SUMMARY"]);

// An element is a "leaf block" if it is a block tag (or a bare DIV) whose own
// content is text + inline elements only (no nested block-level element).
function hasBlockChild(node) {
  for (const child of node.children) {
    if (BLOCK_TAGS.has(child.tagName) || child.tagName === "DIV" || child.tagName === "UL" || child.tagName === "OL" || child.tagName === "TABLE") {
      return true;
    }
  }
  return false;
}

function isCandidate(node) {
  if (BLOCK_TAGS.has(node.tagName)) return true;
  if (node.tagName === "DIV" && !hasBlockChild(node)) return true;
  return false;
}

/**
 * Walk `rootEl` and return [{ el, text }] for each translatable block.
 * Skips per skipRules; avoids double-collecting nested block containers by
 * not descending into a node once it has been collected.
 */
export function collectBlocks(rootEl) {
  const blocks = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (shouldSkip(child)) continue;
      if (isCandidate(child) && !hasBlockChild(child)) {
        const text = child.textContent.replace(/\s+/g, " ").trim();
        if (text && !isPriceOrSymbolOnly(text)) {
          blocks.push({ el: child, text });
        }
        // Do not descend — this leaf block is fully captured.
      } else {
        walk(child); // descend into container looking for leaf blocks
      }
    }
  };
  walk(rootEl);
  return blocks;
}
