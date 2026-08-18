// Adapters that require an API key (keyless does not).
const KEY_REQUIRED = new Set(["openai-compat", "anthropic", "classic-mt"]);

// Long pages translate in batches; without a cap the in-memory cache would
// grow forever on endless-scroll sites.
const CACHE_MAX = 1000;

function cacheSet(map, key, value) {
  map.set(key, value);
  if (map.size > CACHE_MAX) map.delete(map.keys().next().value);
}

/**
 * createDispatcher({ getAdapter, getSettings }) -> { translateBlocks }
 * Dependency-injected so it is unit-testable without browser globals.
 */
export function createDispatcher({ getAdapter, getSettings }) {
  const cache = new Map(); // key: `${providerId}|${targetLang}|${text}` -> translated

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
    // Default languages from settings when caller omits them (e.g. selection popup).
    const tgt = targetLang || settings.targetLang;
    const src = sourceLang || settings.sourceLang || "auto";
    const provider = resolveProvider(settings, providerId);
    const adapter = getAdapter(provider.adapter);

    const ckey = (text) => `${provider.id}|${tgt}|${text}`;
    const results = new Array(blocks.length);
    const missingIdx = [];
    const missingText = [];

    blocks.forEach((text, i) => {
      const hit = cache.get(ckey(text));
      if (hit !== undefined) results[i] = hit;
      else { missingIdx.push(i); missingText.push(text); }
    });

    if (missingText.length > 0) {
      const translated = await adapter.translate(missingText, src, tgt, provider);
      translated.forEach((t, j) => {
        const i = missingIdx[j];
        results[i] = t;
        cacheSet(cache, ckey(missingText[j]), t);
      });
    }
    return results;
  }

  return { translateBlocks };
}
