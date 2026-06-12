import { shouldSkip, isPriceOrSymbolOnly } from "./skipRules.js";

// Blocks longer than this are almost always junk (a whole article collapsed into
// one node, inlined JSON, etc.) — translating them wastes tokens and breaks layout.
const MAX_BLOCK_LENGTH = 5000;

// Concatenation of an element's *direct* text nodes only (not descendant text).
// A non-empty own-text means the element is an inline-flow text unit — e.g.
// `<p>Click <a>here</a> now</p>` or `<a>立即 <b>购买</b> 商品</a>` — and should be
// translated as a single block, preserving the inline markup beneath it.
function ownText(node) {
  let s = "";
  for (const child of node.childNodes) {
    if (child.nodeType === 3) s += child.nodeValue; // text node
  }
  return s.trim();
}

// Does this node have at least one visible child element that carries text?
function hasTextElementChild(node) {
  for (const child of node.children) {
    if (shouldSkip(child)) continue;
    if (child.textContent && child.textContent.trim()) return true;
  }
  return false;
}

// Pure formatting wrappers: when a phrase is split across these (Taobao does
// `<span>免费</span><span>注册</span>`), the parts belong to ONE translation
// unit. Anchors/buttons are interactive items and stay separate units.
const INLINE_FORMATTING = new Set(["SPAN", "B", "I", "EM", "STRONG", "U", "SMALL", "SUP", "SUB", "MARK", "FONT", "ABBR", "BDI", "BDO", "RUBY", "RT"]);
const MERGE_MAX_LENGTH = 300;

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

// Recursively classify a node into translation units.
//
//   - own direct text  -> inline-flow leaf, collect the whole element (keeps
//                         markup like links/bold together, the Immersive feel)
//   - no own text, but text-bearing child elements -> a container; descend so
//                         each child (link, cell, card field) is its own unit.
//                         This is what makes link/span soup on Taobao/Weidian
//                         translate per-item instead of as one giant blob.
//   - otherwise empty   -> ignored
function collect(node, blocks) {
  if (shouldSkip(node)) return;
  const full = node.textContent;
  if (!full || !full.trim()) return;

  if (ownText(node)) {
    pushBlock(blocks, node);
    return;
  }
  // A phrase split across pure formatting spans is one unit, not fragments.
  if (full.trim().length <= MERGE_MAX_LENGTH && onlyFormattingChildren(node)) {
    pushBlock(blocks, node);
    return;
  }
  if (hasTextElementChild(node)) {
    for (const child of node.children) collect(child, blocks);
    return;
  }
  // Text exists but not via own text or element children (rare) — collect as-is.
  pushBlock(blocks, node);
}

/**
 * Walk `rootEl` (inclusive) and return [{ el, text }] for each translatable
 * block. `rootEl` itself is evaluated, so freshly-inserted nodes handed in by
 * the mutation observer are collected, not just their children.
 */
export function collectBlocks(rootEl) {
  const blocks = [];
  collect(rootEl, blocks);
  return blocks;
}
