import { PRESETS } from "../presets.js";
import { MSG } from "../common/messages.js";

const ADAPTER_TYPES = ["keyless", "openai-compat", "classic-mt", "anthropic"];
let settings = null;
let selectedId = null;

async function load() {
  const res = await browser.runtime.sendMessage({ type: MSG.GET_SETTINGS });
  settings = res.settings;
}
async function persist() {
  await browser.runtime.sendMessage({ type: MSG.SAVE_SETTINGS, payload: settings });
}

function uid() { return "p_" + Math.random().toString(36).slice(2, 9); }

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
    li.querySelector(".name").onclick = () => { selectedId = p.id; render(); };
    li.querySelector("input").onchange = async (e) => { p.enabled = e.target.checked; await persist(); };
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
      await persist(); render();
    };
    presetUl.appendChild(li);
  }
}

function field(label, value, onInput, type = "text") {
  const wrap = document.createElement("label");
  wrap.className = "field";
  wrap.innerHTML = `<span>${label}</span>`;
  const input = document.createElement("input");
  input.type = type; input.value = value || "";
  input.oninput = (e) => onInput(e.target.value);
  wrap.appendChild(input);
  return wrap;
}

function renderDetail() {
  const host = document.getElementById("detail");
  host.innerHTML = "";
  const p = settings.providers.find((x) => x.id === selectedId);
  if (!p) { host.innerHTML = '<p class="empty">Select a provider to edit.</p>'; return; }

  host.appendChild(field("Name", p.name, (v) => { p.name = v; persist(); renderList(); }));

  const adapterWrap = document.createElement("label");
  adapterWrap.className = "field";
  adapterWrap.innerHTML = "<span>Adapter type</span>";
  const sel = document.createElement("select");
  for (const t of ADAPTER_TYPES) {
    const o = document.createElement("option"); o.value = t; o.textContent = t;
    if (p.adapter === t) o.selected = true; sel.appendChild(o);
  }
  sel.onchange = (e) => { p.adapter = e.target.value; persist(); renderDetail(); };
  adapterWrap.appendChild(sel);
  host.appendChild(adapterWrap);

  if (p.adapter !== "keyless") {
    host.appendChild(field("API URL", p.apiUrl, (v) => { p.apiUrl = v; persist(); }));
    host.appendChild(field("API key", p.apiKey, (v) => { p.apiKey = v; persist(); }, "password"));
    if (p.adapter !== "classic-mt") host.appendChild(field("Model", p.model, (v) => { p.model = v; persist(); }));
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const def = document.createElement("button");
  def.textContent = "Set as default";
  def.onclick = async () => { settings.defaultProviderId = p.id; await persist(); renderList(); };
  actions.appendChild(def);

  const test = document.createElement("button");
  test.textContent = "Test";
  test.onclick = async () => {
    test.textContent = "Testing…";
    const res = await browser.runtime.sendMessage({ type: MSG.TEST_PROVIDER, payload: p });
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
    selectedId = null; await persist(); render();
  };
  actions.appendChild(del);

  host.appendChild(actions);
}

function render() { renderList(); renderDetail(); }

document.getElementById("add-custom").onclick = async () => {
  const custom = { id: uid(), name: "Custom service", adapter: "openai-compat", apiUrl: "", apiKey: "", model: "", enabled: true };
  settings.providers.push(custom); selectedId = custom.id; await persist(); render();
};

(async () => { await load(); render(); })();
