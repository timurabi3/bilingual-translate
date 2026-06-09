import { LANGS } from "../common/langs.js";
import { MSG } from "../common/messages.js";

function fillLangs(sel, excludeAuto) {
  for (const l of LANGS) {
    if (excludeAuto && l.code === "auto") continue;
    const o = document.createElement("option");
    o.value = l.code; o.textContent = l.name; sel.appendChild(o);
  }
}

async function getSettings() {
  const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
  return res.settings;
}

async function init() {
  const sourceSel = document.getElementById("source");
  const targetSel = document.getElementById("target");
  const provSel = document.getElementById("provider");
  fillLangs(sourceSel, false);
  fillLangs(targetSel, true);

  const s = await getSettings();
  sourceSel.value = s.sourceLang;
  targetSel.value = s.targetLang;
  for (const p of s.providers.filter((p) => p.enabled)) {
    const o = document.createElement("option");
    o.value = p.id; o.textContent = p.name; provSel.appendChild(o);
  }
  provSel.value = s.defaultProviderId;

  async function persist() {
    await browser.runtime.sendMessage({
      type: MSG.SAVE_SETTINGS,
      payload: { sourceLang: sourceSel.value, targetLang: targetSel.value, defaultProviderId: provSel.value },
    });
  }
  sourceSel.onchange = persist; targetSel.onchange = persist; provSel.onchange = persist;

  document.getElementById("translate").onclick = async () => {
    await persist();
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    await browser.tabs.sendMessage(tab.id, {
      type: MSG.TRIGGER_TRANSLATE,
      payload: { sourceLang: sourceSel.value, targetLang: targetSel.value },
    });
    window.close();
  };

  document.querySelectorAll(".modes button").forEach((btn) => {
    btn.onclick = async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      await browser.tabs.sendMessage(tab.id, { type: MSG.SET_DISPLAY_MODE, payload: { mode: btn.dataset.mode } });
    };
  });

  document.getElementById("open-settings").onclick = (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  };
}

init();
