import { MSG } from "../common/messages.js";

let tip = null;
let token = 0; // guards against out-of-order async responses

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.setAttribute("data-xlate", "1");
  tip.className = "xlate-tooltip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  return tip;
}

function hide() {
  if (tip) tip.style.display = "none";
}

function position(t, rect) {
  t.style.visibility = "hidden";
  t.style.display = "block";
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  let left = window.scrollX + rect.left;
  let top = window.scrollY + rect.bottom + 6;
  // Clamp horizontally to the viewport.
  const maxLeft = window.scrollX + document.documentElement.clientWidth - tw - 8;
  if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
  // Flip above the selection if it would overflow the bottom.
  if (rect.bottom + th + 12 > document.documentElement.clientHeight) {
    top = window.scrollY + rect.top - th - 6;
  }
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
  t.style.visibility = "visible";
}

function inEditable(node) {
  let el = node && node.nodeType === 3 ? node.parentElement : node;
  while (el) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

async function onMouseUp() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : "";
  if (!text || !sel.rangeCount) {
    hide();
    return;
  }
  if (inEditable(sel.anchorNode)) return; // don't interfere with typing

  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const t = ensureTip();
  const myToken = ++token;
  t.textContent = "…";
  position(t, rect);

  try {
    const res = await browser.runtime.sendMessage({
      type: MSG.TRANSLATE_BLOCKS,
      payload: { blocks: [text], sourceLang: "auto", targetLang: undefined },
    });
    if (myToken !== token) return; // a newer selection superseded this one
    t.textContent = res.ok ? res.translations[0] : `⚠ ${res.error}`;
    position(t, rect);
  } catch (e) {
    if (myToken !== token) return;
    t.textContent = `⚠ ${e.message}`;
  }
}

document.addEventListener("mouseup", () => setTimeout(onMouseUp, 0));
document.addEventListener("mousedown", (e) => {
  if (tip && !tip.contains(e.target)) hide();
});
document.addEventListener("scroll", hide, true);
