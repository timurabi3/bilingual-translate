import { LANGS } from "../common/langs.js";
import { MSG } from "../common/messages.js";
import { domainMatches } from "../common/domains.js";

function fillLangs(sel, excludeAuto) {
  for (const l of LANGS) {
    if (excludeAuto && l.code === "auto") continue;
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = l.name;
    sel.appendChild(o);
  }
}

async function getSettings() {
  const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
  return res.settings;
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function status(text) {
  const el = document.getElementById("status");
  el.textContent = text || "";
  el.hidden = !text;
}

async function sendToActiveTab(message) {
  const tab = await activeTab();
  await browser.tabs.sendMessage(tab.id, message);
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
    o.value = p.id;
    o.textContent = p.name;
    provSel.appendChild(o);
  }
  provSel.value = s.defaultProviderId;

  // Reflect the saved display mode in the segmented control.
  setActiveMode(s.displayMode || "bilingual");

  async function persist(extra) {
    await browser.runtime.sendMessage({
      type: MSG.SAVE_SETTINGS,
      payload: {
        sourceLang: sourceSel.value,
        targetLang: targetSel.value,
        defaultProviderId: provSel.value,
        ...extra,
      },
    });
  }
  sourceSel.onchange = () => persist();
  targetSel.onchange = () => persist();
  provSel.onchange = () => persist();

  // "Always translate this site" — hosts saved in settings, matched with
  // subdomains on load by the content script.
  const tab = await activeTab();
  const host = (() => {
    try {
      return new URL(tab?.url || "").hostname;
    } catch {
      return "";
    }
  })();
  const autoBox = document.getElementById("auto-site");
  const autoRow = document.getElementById("auto-row");
  if (!host) autoRow.classList.add("disabled");
  autoBox.checked = !!host && (s.autoTranslateDomains || []).some((d) => domainMatches(host, d));
  autoBox.onchange = async () => {
    const domains = (s.autoTranslateDomains || []).filter((d) => d !== host);
    if (autoBox.checked) domains.push(host);
    await persist({ autoTranslateDomains: domains });
  };

  document.getElementById("swap").onclick = async () => {
    // "auto" cannot be a target; swap to the detected-or-default pair sensibly.
    const src = sourceSel.value === "auto" ? targetSel.value : sourceSel.value;
    const tgt = targetSel.value;
    targetSel.value = src;
    sourceSel.value = tgt;
    await persist();
  };

  document.getElementById("translate").onclick = async () => {
    await persist();
    try {
      await sendToActiveTab({
        type: MSG.TRIGGER_TRANSLATE,
        payload: { sourceLang: sourceSel.value, targetLang: targetSel.value },
      });
      window.close();
    } catch {
      status("Can't reach this page. Browser pages (chrome://…) and not-yet-loaded tabs can't be translated.");
    }
  };

  document.querySelectorAll(".modes button").forEach((btn) => {
    btn.onclick = async () => {
      setActiveMode(btn.dataset.mode);
      await persist({ displayMode: btn.dataset.mode });
      try {
        await sendToActiveTab({ type: MSG.SET_DISPLAY_MODE, payload: { mode: btn.dataset.mode } });
        status("");
      } catch {
        status("Can't reach this page — mode is saved and will apply on the next translatable tab.");
      }
    };
  });

  document.getElementById("open-settings").onclick = (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  };
}

function setActiveMode(mode) {
  document.querySelectorAll(".modes button").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

init();
