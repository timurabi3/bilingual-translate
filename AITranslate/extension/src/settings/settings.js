import { PRESETS } from "../presets.js";
import { MSG } from "../common/messages.js";

// Human labels for the adapter dropdown. The value stays the internal adapter
// id, the label is what a person actually understands.
const ADAPTER_TYPES = [
  { value: "keyless", label: "Free (Google Translate)", hint: "Google's free endpoint. No key, no signup, works immediately." },
  { value: "openai-compat", label: "OpenAI-compatible (OpenAI, DeepSeek, Groq, Ollama…)", hint: "Any service that speaks the OpenAI /chat/completions API. Pick the model below or type your own." },
  { value: "classic-mt", label: "Classic MT (DeepL / Google Cloud)", hint: "Dedicated translation APIs instead of LLMs. Usually cheaper and faster for whole pages." },
  { value: "anthropic", label: "Anthropic (Claude)", hint: "Claude directly via Anthropic's /v1/messages API." },
];

// Sensible defaults that fill empty fields when you switch adapter type.
const ADAPTER_TEMPLATES = {
  keyless: {},
  "openai-compat": { apiUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  "classic-mt": { apiUrl: "https://api-free.deepl.com/v2/translate", variant: "deepl" },
  anthropic: { apiUrl: "https://api.anthropic.com/v1/messages", model: "claude-haiku-4-5-20251001" },
};

// Common model names so you can pick instead of knowing exact IDs.
const MODEL_SUGGESTIONS = {
  "openai-compat": [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-5-mini",
    "deepseek-chat",
    "deepseek-reasoner",
    "llama-3.3-70b-versatile",
    "llama-4-scout-17b-16e-instruct",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4-5",
    "llama3.1",
    "qwen2.5:7b",
    "mistral",
  ],
  anthropic: [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5-20250929",
    "claude-opus-4-5-20251101",
  ],
};

let settings = null;
let selectedId = null;

async function load() {
  const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
  settings = res.settings;
}

// Saves are serialized: each one waits for the previous one to finish.
// Before this, rapid typing fired saves out of order and an older snapshot
// could overwrite the newer one — edits silently got lost.
let saveChain = Promise.resolve();
function persist() {
  saveChain = saveChain.then(() =>
    browser.runtime.sendMessage({
      type: MSG.SAVE_SETTINGS,
      payload: JSON.parse(JSON.stringify(settings)),
    })
  );
  return saveChain;
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

function hint(text) {
  const p = document.createElement("p");
  p.className = "hint";
  p.textContent = text;
  return p;
}

function field(label, value, onInput, type = "text", suggestions = null) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  wrap.innerHTML = `<span>${label}</span>`;
  const input = document.createElement("input");
  input.type = type;
  input.value = value || "";
  input.oninput = (e) => onInput(e.target.value);
  if (suggestions && suggestions.length) {
    const dl = document.createElement("datalist");
    dl.id = "dl_" + Math.random().toString(36).slice(2, 8);
    for (const s of suggestions) {
      const o = document.createElement("option");
      o.value = s;
      dl.appendChild(o);
    }
    wrap.appendChild(dl);
    input.setAttribute("list", dl.id);
  }
  wrap.appendChild(input);
  return wrap;
}

function selectField(labelText, options, current, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "field";
  wrap.innerHTML = `<span>${labelText}</span>`;
  const sel = document.createElement("select");
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (current === o.value) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.onchange = (e) => onChange(e.target.value);
  wrap.appendChild(sel);
  return wrap;
}

function modelSuggestionsFor(p) {
  const base = MODEL_SUGGESTIONS[p.adapter] || [];
  const preset = PRESETS.find((pr) => pr.adapter === p.adapter && pr.name === p.name);
  const extra = preset && preset.model ? [preset.model] : [];
  return [...new Set([...extra, ...base])].filter(Boolean);
}

function renderList() {
  const ul = document.getElementById("provider-list");
  ul.innerHTML = "";
  for (const p of settings.providers) {
    const li = document.createElement("li");
    li.className = p.id === selectedId ? "selected" : "";
    li.innerHTML = `
      <span class="name">${p.name}</span>
      <span class="badges">${settings.defaultProviderId === p.id ? '<em class="default">default</em>' : ""}</span>
      <input type="checkbox" ${p.enabled ? "checked" : ""} />`;
    li.querySelector(".name").onclick = () => {
      selectedId = p.id;
      render();
    };
    li.querySelector("input").title = "Enable or disable this provider";
    li.querySelector("input").onchange = async (e) => {
      p.enabled = e.target.checked;
      await persist();
    };
    ul.appendChild(li);
  }

  const presetUl = document.getElementById("preset-list");
  presetUl.innerHTML = "";
  for (const preset of PRESETS) {
    const li = document.createElement("li");
    li.innerHTML = `<button>+ ${preset.name}</button>`;
    li.querySelector("button").onclick = async () => {
      const clone = { ...preset, id: uid(), enabled: true };
      settings.providers.push(clone);
      selectedId = clone.id;
      await persist();
      render();
    };
    presetUl.appendChild(li);
  }

  // Auto-translate domains: added via the popup checkbox, removed here.
  const autoUl = document.getElementById("auto-list");
  autoUl.innerHTML = "";
  for (const d of settings.autoTranslateDomains || []) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name">${d}</span><button title="Stop auto-translating this site">✕</button>`;
    li.querySelector("button").onclick = async () => {
      settings.autoTranslateDomains = (settings.autoTranslateDomains || []).filter((x) => x !== d);
      await persist();
      renderList();
    };
    autoUl.appendChild(li);
  }
}

function renderDetail() {
  const host = document.getElementById("detail");
  host.innerHTML = "";
  const p = settings.providers.find((x) => x.id === selectedId);
  if (!p) {
    host.innerHTML = '<p class="empty">Select a provider to edit.</p>';
    return;
  }

  host.appendChild(
    field("Name", p.name, (v) => {
      p.name = v;
      persist();
      renderList();
    })
  );

  const adapterMeta = ADAPTER_TYPES.find((t) => t.value === p.adapter) || ADAPTER_TYPES[1];
  host.appendChild(
    selectField("Adapter type", ADAPTER_TYPES, p.adapter, (v) => {
      p.adapter = v;
      const tpl = ADAPTER_TEMPLATES[v] || {};
      if (!p.apiUrl && tpl.apiUrl) p.apiUrl = tpl.apiUrl;
      if (!p.model && tpl.model) p.model = tpl.model;
      if (tpl.variant) p.variant = tpl.variant;
      persist();
      renderDetail();
    })
  );
  host.appendChild(hint(adapterMeta.hint));

  if (p.adapter !== "keyless") {
    host.appendChild(
      field("API URL", p.apiUrl, (v) => {
        p.apiUrl = v;
        persist();
      })
    );
    host.appendChild(
      field("API key", p.apiKey, (v) => {
        p.apiKey = v;
        persist();
      }, "password")
    );

    if (p.adapter === "classic-mt") {
      const VARIANT_URLS = {
        deepl: "https://api-free.deepl.com/v2/translate",
        "google-cloud": "https://translation.googleapis.com/language/translate/v2",
      };
      host.appendChild(
        selectField(
          "Service",
          [
            { value: "deepl", label: "DeepL" },
            { value: "google-cloud", label: "Google Cloud Translate" },
          ],
          p.variant || "deepl",
          (v) => {
            p.variant = v;
            // Swap the URL only when it's still one of the known defaults.
            if (!p.apiUrl || Object.values(VARIANT_URLS).includes(p.apiUrl)) p.apiUrl = VARIANT_URLS[v];
            persist();
            renderDetail();
          }
        )
      );
    } else {
      host.appendChild(
        field("Model", p.model, (v) => {
          p.model = v;
          persist();
        }, "text", modelSuggestionsFor(p))
      );
    }
  } else {
    host.appendChild(hint("No key needed — this is the free default."));
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const def = document.createElement("button");
  def.textContent = "Set as default";
  def.onclick = async () => {
    settings.defaultProviderId = p.id;
    await persist();
    renderList();
  };
  actions.appendChild(def);

  const test = document.createElement("button");
  test.className = "primary";
  test.textContent = "Test";
  test.onclick = async () => {
    test.textContent = "Testing…";
    const res = await browser.runtime.sendMessage({ type: MSG.TEST_PROVIDER, payload: JSON.parse(JSON.stringify(p)) });
    test.textContent = res.ok ? `OK: ${res.sample}` : `Fail: ${res.error}`;
    setTimeout(() => (test.textContent = "Test"), 4000);
  };
  actions.appendChild(test);

  const del = document.createElement("button");
  del.textContent = "Remove";
  del.className = "danger";
  del.onclick = async () => {
    settings.providers = settings.providers.filter((x) => x.id !== p.id);
    if (settings.defaultProviderId === p.id) settings.defaultProviderId = settings.providers[0]?.id || "keyless";
    selectedId = null;
    await persist();
    render();
  };
  actions.appendChild(del);

  host.appendChild(actions);
}

function render() {
  renderList();
  renderDetail();
}

document.getElementById("add-custom").onclick = async () => {
  const custom = {
    id: uid(),
    name: "Custom service",
    adapter: "openai-compat",
    apiUrl: ADAPTER_TEMPLATES["openai-compat"].apiUrl,
    apiKey: "",
    model: ADAPTER_TEMPLATES["openai-compat"].model,
    enabled: true,
  };
  settings.providers.push(custom);
  selectedId = custom.id;
  await persist();
  render();
};

// Export the full config as JSON. Keys are included by default, tick the
// checkbox off to share a config without them.
document.getElementById("export-config").onclick = () => {
  const data = JSON.parse(JSON.stringify(settings));
  if (!document.getElementById("export-keys").checked) {
    data.providers = data.providers.map(({ apiKey, ...rest }) => ({ ...rest, apiKey: "" }));
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bilingual-translate-settings.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

// Import a previously exported config. Replaces the provider list; languages,
// default provider and auto-translate domains are taken over too.
document.getElementById("import-config").onchange = async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || !Array.isArray(imported.providers)) throw new Error("no providers array found");
    for (const p of imported.providers) {
      if (!p.id || !p.name || !p.adapter) throw new Error("malformed provider entry");
    }
    settings.providers = imported.providers;
    if (imported.defaultProviderId) settings.defaultProviderId = imported.defaultProviderId;
    if (imported.targetLang) settings.targetLang = imported.targetLang;
    if (imported.sourceLang) settings.sourceLang = imported.sourceLang;
    if (imported.displayMode) settings.displayMode = imported.displayMode;
    if (Array.isArray(imported.autoTranslateDomains)) settings.autoTranslateDomains = imported.autoTranslateDomains;
    selectedId = null;
    await persist();
    render();
  } catch (err) {
    alert("Import failed: " + err.message);
  }
  e.target.value = "";
};

(async () => {
  await load();
  render();
})();
