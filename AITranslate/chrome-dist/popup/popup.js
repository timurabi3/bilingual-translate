globalThis.browser ??= globalThis.chrome;

(() => {
  // src/common/langs.js
  var LANGS = [
    { code: "auto", name: "Auto-detect" },
    { code: "de", name: "Deutsch" },
    { code: "en", name: "English" },
    { code: "zh", name: "\u4E2D\u6587" },
    { code: "es", name: "Espa\xF1ol" },
    { code: "fr", name: "Fran\xE7ais" },
    { code: "ja", name: "\u65E5\u672C\u8A9E" },
    { code: "ru", name: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
    { code: "ar", name: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" }
  ];

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

  // src/popup/popup.js
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
    for (const p of s.providers.filter((p2) => p2.enabled)) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      provSel.appendChild(o);
    }
    provSel.value = s.defaultProviderId;
    setActiveMode(s.displayMode || "bilingual");
    async function persist(extra) {
      await browser.runtime.sendMessage({
        type: MSG.SAVE_SETTINGS,
        payload: {
          sourceLang: sourceSel.value,
          targetLang: targetSel.value,
          defaultProviderId: provSel.value,
          ...extra
        }
      });
    }
    sourceSel.onchange = () => persist();
    targetSel.onchange = () => persist();
    provSel.onchange = () => persist();
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
          payload: { sourceLang: sourceSel.value, targetLang: targetSel.value }
        });
        window.close();
      } catch {
        status("Can't reach this page. Browser pages (chrome://\u2026) and not-yet-loaded tabs can't be translated.");
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
          status("Can't reach this page \u2014 mode is saved and will apply on the next translatable tab.");
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
})();
