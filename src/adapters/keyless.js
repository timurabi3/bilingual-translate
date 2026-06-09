const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

async function translateOne(text, sourceLang, targetLang) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: sourceLang || "auto",
    tl: targetLang,
    dt: "t",
    q: text,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`keyless: HTTP ${res.status}`);
  const data = await res.json();
  // data[0] is an array of [translatedChunk, originalChunk, ...]
  return (data[0] || []).map((seg) => seg[0]).join("");
}

export const keylessAdapter = {
  id: "keyless",
  async translate(blocks, sourceLang, targetLang) {
    const out = [];
    for (const b of blocks) {
      out.push(await translateOne(b, sourceLang, targetLang));
    }
    return out;
  },
};
