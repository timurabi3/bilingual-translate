import { keylessAdapter } from "./keyless.js";
import { openaiCompatAdapter } from "./openaiCompat.js";
import { classicMtAdapter } from "./classicMt.js";
import { anthropicAdapter } from "./anthropic.js";

const ADAPTERS = {
  keyless: keylessAdapter,
  "openai-compat": openaiCompatAdapter,
  "classic-mt": classicMtAdapter,
  anthropic: anthropicAdapter,
};

export function getAdapter(id) {
  const a = ADAPTERS[id];
  if (!a) throw new Error(`Unknown adapter: ${id}`);
  return a;
}
