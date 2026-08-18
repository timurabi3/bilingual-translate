import { buildNumberedPrompt, parseNumberedResponse } from "./types.js";

function systemPrompt(sourceLang, targetLang) {
  const from = sourceLang && sourceLang !== "auto" ? `from ${sourceLang} ` : "";
  return (
    `You are a translation engine. Translate the numbered list ${from}into ${targetLang}. ` +
    `Return ONLY the same numbered list with translations, same count, same order. ` +
    `Do not add notes, do not merge or split items.`
  );
}

const FETCH_TIMEOUT_MS = 30000;

async function call(content, config) {
  let res;
  try {
    res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: content.system },
          { role: "user", content: content.user },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`openai-compat: timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  }
  if (!res.ok) throw new Error(`openai-compat: HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export const openaiCompatAdapter = {
  id: "openai-compat",
  async translate(blocks, sourceLang, targetLang, config) {
    const system = systemPrompt(sourceLang, targetLang);
    const reply = await call({ system, user: buildNumberedPrompt(blocks) }, config);
    const parsed = parseNumberedResponse(reply, blocks.length);
    if (parsed) return parsed;
    // Fallback: one request per block.
    const out = [];
    for (const b of blocks) {
      const r = await call({ system, user: b }, config);
      out.push(r.trim());
    }
    return out;
  },
};
