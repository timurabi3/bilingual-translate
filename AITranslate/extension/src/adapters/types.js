/**
 * @typedef {Object} ProviderConfig
 * @property {string} apiUrl
 * @property {string} apiKey
 * @property {string} model
 */

/**
 * Adapter interface (documentation only — JS has no interfaces):
 *   async translate(blocks: string[], sourceLang: string, targetLang: string, config: ProviderConfig)
 *     => Promise<string[]>  // same length & order as `blocks`
 */

export function buildNumberedPrompt(blocks) {
  return blocks.map((b, i) => `${i + 1}. ${b}`).join("\n");
}

/**
 * Parse "1. ...\n2. ..." back into an array of `expectedCount` strings.
 * Returns null if the parsed count != expectedCount (caller falls back to per-block).
 */
export function parseNumberedResponse(text, expectedCount) {
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
