import { MSG } from "../common/messages.js";

let tip = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.setAttribute("data-xlate", "1");
  tip.className = "xlate-tooltip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  return tip;
}

async function onMouseUp() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : "";
  if (!text) { if (tip) tip.style.display = "none"; return; }
  const range = sel.getRangeAt(0).getBoundingClientRect();
  const t = ensureTip();
  t.textContent = "…";
  t.style.display = "block";
  t.style.top = `${window.scrollY + range.bottom + 6}px`;
  t.style.left = `${window.scrollX + range.left}px`;
  try {
    const res = await browser.runtime.sendMessage({
      type: MSG.TRANSLATE_BLOCKS,
      payload: { blocks: [text], sourceLang: "auto", targetLang: undefined },
    });
    t.textContent = res.ok ? res.translations[0] : `⚠ ${res.error}`;
  } catch (e) {
    t.textContent = `⚠ ${e.message}`;
  }
}

document.addEventListener("mouseup", () => { onMouseUp(); });
