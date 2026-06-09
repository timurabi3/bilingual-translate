import { buildNumberedPrompt, parseNumberedResponse } from "./types.js";

const ANTHROPIC_VERSION = "2023-06-01";

function systemPrompt(sourceLang, targetLang) {
  const from = sourceLang && sourceLang !== "auto" ? `from ${sourceLang} ` : "";
  return (
    `You are a translation engine. Translate the numbered list ${from}into ${targetLang}. ` +
    `Return ONLY the same numbered list with translations, same count, same order.`
  );
}

async function call(system, user, config) {
  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic: HTTP ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

export const anthropicAdapter = {
  id: "anthropic",
  async translate(blocks, sourceLang, targetLang, config) {
    const system = systemPrompt(sourceLang, targetLang);
    const reply = await call(system, buildNumberedPrompt(blocks), config);
    const parsed = parseNumberedResponse(reply, blocks.length);
    if (parsed) return parsed;
    const out = [];
    for (const b of blocks) out.push((await call(system, b, config)).trim());
    return out;
  },
};
