const FETCH_TIMEOUT_MS = 30000;

function timeoutError(id) {
  return new Error(`${id}: timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
}

async function deepl(blocks, sourceLang, targetLang, config) {
  const body = new URLSearchParams();
  for (const b of blocks) body.append("text", b);
  body.append("target_lang", targetLang);
  if (sourceLang && sourceLang !== "auto") body.append("source_lang", sourceLang);
  let res;
  try {
    res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `DeepL-Auth-Key ${config.apiKey}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw timeoutError("classic-mt(deepl)");
    throw e;
  }
  if (!res.ok) throw new Error(`classic-mt(deepl): HTTP ${res.status}`);
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

async function googleCloud(blocks, sourceLang, targetLang, config) {
  const url = `${config.apiUrl}?key=${encodeURIComponent(config.apiKey)}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: blocks,
        target: targetLang,
        ...(sourceLang && sourceLang !== "auto" ? { source: sourceLang } : {}),
        format: "text",
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) throw timeoutError("classic-mt(google-cloud)");
    throw e;
  }
  if (!res.ok) throw new Error(`classic-mt(google-cloud): HTTP ${res.status}`);
  const data = await res.json();
  return data.data.translations.map((t) => t.translatedText);
}

export const classicMtAdapter = {
  id: "classic-mt",
  async translate(blocks, sourceLang, targetLang, config) {
    if (config.variant === "google-cloud") return googleCloud(blocks, sourceLang, targetLang, config);
    return deepl(blocks, sourceLang, targetLang, config);
  },
};
