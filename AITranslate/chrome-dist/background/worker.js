globalThis.browser ??= globalThis.chrome;

(() => {
  // src/adapters/keyless.js
  var ENDPOINT = "https://translate.googleapis.com/translate_a/single";
  async function translateOne(text, sourceLang, targetLang) {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLang || "auto",
      tl: targetLang,
      dt: "t",
      q: text
    });
    const res = await fetch(`${ENDPOINT}?${params.toString()}`);
    if (!res.ok) throw new Error(`keyless: HTTP ${res.status}`);
    const data = await res.json();
    return (data[0] || []).map((seg) => seg[0]).join("");
  }
  var keylessAdapter = {
    id: "keyless",
    async translate(blocks, sourceLang, targetLang) {
      const out = [];
      for (const b of blocks) {
        out.push(await translateOne(b, sourceLang, targetLang));
      }
      return out;
    }
  };

  // src/adapters/types.js
  function buildNumberedPrompt(blocks) {
    return blocks.map((b, i) => `${i + 1}. ${b}`).join("\n");
  }
  function parseNumberedResponse(text, expectedCount) {
    const lines = text.split("\n");
    const blocks = [];
    let current = null;
    const marker = /^\s*(\d+)\.\s?(.*)$/;
    for (const line of lines) {
      const m = line.match(marker);
      if (m) {
        if (current !== null) blocks.push(current.join("\n").trim());
        current = [m[2]];
      } else if (current !== null) {
        current.push(line);
      }
    }
    if (current !== null) blocks.push(current.join("\n").trim());
    return blocks.length === expectedCount ? blocks : null;
  }

  // src/adapters/openaiCompat.js
  function systemPrompt(sourceLang, targetLang) {
    const from = sourceLang && sourceLang !== "auto" ? `from ${sourceLang} ` : "";
    return `You are a translation engine. Translate the numbered list ${from}into ${targetLang}. Return ONLY the same numbered list with translations, same count, same order. Do not add notes, do not merge or split items.`;
  }
  async function call(content, config) {
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: content.system },
          { role: "user", content: content.user }
        ],
        temperature: 0
      })
    });
    if (!res.ok) throw new Error(`openai-compat: HTTP ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }
  var openaiCompatAdapter = {
    id: "openai-compat",
    async translate(blocks, sourceLang, targetLang, config) {
      const system = systemPrompt(sourceLang, targetLang);
      const reply = await call({ system, user: buildNumberedPrompt(blocks) }, config);
      const parsed = parseNumberedResponse(reply, blocks.length);
      if (parsed) return parsed;
      const out = [];
      for (const b of blocks) {
        const r = await call({ system, user: b }, config);
        out.push(r.trim());
      }
      return out;
    }
  };

  // src/adapters/classicMt.js
  async function deepl(blocks, sourceLang, targetLang, config) {
    const body = new URLSearchParams();
    for (const b of blocks) body.append("text", b);
    body.append("target_lang", targetLang);
    if (sourceLang && sourceLang !== "auto") body.append("source_lang", sourceLang);
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `DeepL-Auth-Key ${config.apiKey}`
      },
      body: body.toString()
    });
    if (!res.ok) throw new Error(`classic-mt(deepl): HTTP ${res.status}`);
    const data = await res.json();
    return data.translations.map((t) => t.text);
  }
  async function googleCloud(blocks, sourceLang, targetLang, config) {
    const url = `${config.apiUrl}?key=${encodeURIComponent(config.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: blocks,
        target: targetLang,
        ...sourceLang && sourceLang !== "auto" ? { source: sourceLang } : {},
        format: "text"
      })
    });
    if (!res.ok) throw new Error(`classic-mt(google-cloud): HTTP ${res.status}`);
    const data = await res.json();
    return data.data.translations.map((t) => t.translatedText);
  }
  var classicMtAdapter = {
    id: "classic-mt",
    async translate(blocks, sourceLang, targetLang, config) {
      if (config.variant === "google-cloud") return googleCloud(blocks, sourceLang, targetLang, config);
      return deepl(blocks, sourceLang, targetLang, config);
    }
  };

  // src/adapters/anthropic.js
  var ANTHROPIC_VERSION = "2023-06-01";
  function systemPrompt2(sourceLang, targetLang) {
    const from = sourceLang && sourceLang !== "auto" ? `from ${sourceLang} ` : "";
    return `You are a translation engine. Translate the numbered list ${from}into ${targetLang}. Return ONLY the same numbered list with translations, same count, same order.`;
  }
  async function call2(system, user, config) {
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!res.ok) throw new Error(`anthropic: HTTP ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
  }
  var anthropicAdapter = {
    id: "anthropic",
    async translate(blocks, sourceLang, targetLang, config) {
      const system = systemPrompt2(sourceLang, targetLang);
      const reply = await call2(system, buildNumberedPrompt(blocks), config);
      const parsed = parseNumberedResponse(reply, blocks.length);
      if (parsed) return parsed;
      const out = [];
      for (const b of blocks) out.push((await call2(system, b, config)).trim());
      return out;
    }
  };

  // src/adapters/registry.js
  var ADAPTERS = {
    keyless: keylessAdapter,
    "openai-compat": openaiCompatAdapter,
    "classic-mt": classicMtAdapter,
    anthropic: anthropicAdapter
  };
  function getAdapter(id) {
    const a = ADAPTERS[id];
    if (!a) throw new Error(`Unknown adapter: ${id}`);
    return a;
  }

  // src/presets.js
  var PRESETS = [
    { id: "keyless", name: "Free (Google Translate)", adapter: "keyless", apiUrl: "", apiKey: "", model: "" },
    { id: "openai", name: "OpenAI", adapter: "openai-compat", apiUrl: "https://api.openai.com/v1/chat/completions", apiKey: "", model: "gpt-4o-mini" },
    { id: "deepseek", name: "DeepSeek", adapter: "openai-compat", apiUrl: "https://api.deepseek.com/chat/completions", apiKey: "", model: "deepseek-chat" },
    { id: "groq", name: "Groq", adapter: "openai-compat", apiUrl: "https://api.groq.com/openai/v1/chat/completions", apiKey: "", model: "llama-3.3-70b-versatile" },
    { id: "openrouter", name: "OpenRouter", adapter: "openai-compat", apiUrl: "https://openrouter.ai/api/v1/chat/completions", apiKey: "", model: "openai/gpt-4o-mini" },
    { id: "ollama", name: "Ollama (local)", adapter: "openai-compat", apiUrl: "http://localhost:11434/v1/chat/completions", apiKey: "ollama", model: "llama3.1" },
    { id: "deepl", name: "DeepL", adapter: "classic-mt", apiUrl: "https://api-free.deepl.com/v2/translate", apiKey: "", model: "", variant: "deepl" },
    { id: "google-cloud", name: "Google Cloud Translate", adapter: "classic-mt", apiUrl: "https://translation.googleapis.com/language/translate/v2", apiKey: "", model: "", variant: "google-cloud" },
    { id: "anthropic", name: "Anthropic (Claude)", adapter: "anthropic", apiUrl: "https://api.anthropic.com/v1/messages", apiKey: "", model: "claude-haiku-4-5-20251001" }
  ];

  // src/background/storage.js
  var DEFAULT_SETTINGS = {
    // Seed providers: the keyless default is enabled out of the box.
    providers: [{ ...PRESETS[0], enabled: true }],
    defaultProviderId: "keyless",
    sourceLang: "auto",
    targetLang: "de",
    displayMode: "bilingual",
    // "bilingual" | "original" | "translation"
    autoTranslateDomains: []
  };
  var KEY = "settings";
  async function loadSettings() {
    const got = await browser.storage.local.get(KEY);
    return { ...DEFAULT_SETTINGS, ...got[KEY] || {} };
  }
  async function saveSettings(partial) {
    const current = await loadSettings();
    const next = { ...current, ...partial };
    await browser.storage.local.set({ [KEY]: next });
    return next;
  }

  // src/background/dispatch.js
  var KEY_REQUIRED = /* @__PURE__ */ new Set(["openai-compat", "anthropic", "classic-mt"]);
  function createDispatcher({ getAdapter: getAdapter2, getSettings }) {
    const cache = /* @__PURE__ */ new Map();
    function resolveProvider(settings, providerId) {
      const id = providerId || settings.defaultProviderId;
      const p = settings.providers.find((x) => x.id === id) || settings.providers[0];
      if (!p) throw new Error("No translation provider configured.");
      if (KEY_REQUIRED.has(p.adapter) && !p.apiKey) {
        throw new Error(`API key missing for provider "${p.name}". Set it in Settings.`);
      }
      return p;
    }
    async function translateBlocks({ blocks, sourceLang, targetLang, providerId }) {
      const settings = await getSettings();
      const tgt = targetLang || settings.targetLang;
      const src = sourceLang || settings.sourceLang || "auto";
      const provider = resolveProvider(settings, providerId);
      const adapter = getAdapter2(provider.adapter);
      const ckey = (text) => `${provider.id}|${tgt}|${text}`;
      const results = new Array(blocks.length);
      const missingIdx = [];
      const missingText = [];
      blocks.forEach((text, i) => {
        const hit = cache.get(ckey(text));
        if (hit !== void 0) results[i] = hit;
        else {
          missingIdx.push(i);
          missingText.push(text);
        }
      });
      if (missingText.length > 0) {
        const translated = await adapter.translate(missingText, src, tgt, provider);
        translated.forEach((t, j) => {
          const i = missingIdx[j];
          results[i] = t;
          cache.set(ckey(missingText[j]), t);
        });
      }
      return results;
    }
    return { translateBlocks };
  }

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

  // src/background/worker.js
  var dispatcher = createDispatcher({ getAdapter, getSettings: loadSettings });
  browser.runtime.onMessage.addListener(async (msg) => {
    switch (msg.type) {
      case MSG.TRANSLATE_BLOCKS:
        try {
          const translations = await dispatcher.translateBlocks(msg.payload);
          return { ok: true, translations };
        } catch (e) {
          return { ok: false, error: String(e.message || e) };
        }
      case MSG.GET_SETTINGS:
        return { ok: true, settings: await loadSettings() };
      case MSG.SAVE_SETTINGS:
        return { ok: true, settings: await saveSettings(msg.payload) };
      case MSG.TEST_PROVIDER:
        try {
          const adapter = getAdapter(msg.payload.adapter);
          const out = await adapter.translate(["Hello world"], "auto", "de", msg.payload);
          return { ok: true, sample: out[0] };
        } catch (e) {
          return { ok: false, error: String(e.message || e) };
        }
      default:
        return { ok: false, error: `Unknown message type: ${msg.type}` };
    }
  });
})();
