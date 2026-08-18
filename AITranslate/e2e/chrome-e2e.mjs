// E2E test: loads the built extension into real Google Chrome and verifies
// end-to-end translation on a local test page.
//
// Run:  node chrome-e2e.mjs
// Needs: npm i playwright-core  (drives the system Chrome via CDP — no browser download)
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(__dirname, "../chrome-dist");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const PROFILE_DIR = path.join(__dirname, ".profile-e2e");
const PORT = 8741;

const TEST_PAGE = `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>E2E Test Page</title></head>
<body>
  <h1 id="h1">慕尼黑旅游指南</h1>
  <p id="p1">慕尼黑是德国巴伐利亚州的首府，位于伊萨尔河畔。这座城市以一年一度的啤酒节闻名世界。</p>
  <p id="p2">市中心的玛丽亚广场坐落着著名的新市政厅，其钟楼每天中午都会上演木偶表演。</p>
  <p id="p3">慕尼黑拥有众多博物馆、广阔的公园以及世界顶尖的大学和科研机构。</p>
  <ul>
    <li>宝马博物馆</li>
    <li>德意志博物馆</li>
    <li>英国花园</li>
  </ul>
</body>
</html>`;

const log = (...a) => console.log("[e2e]", ...a);

// --- 1. local HTTP server for the test page -------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(TEST_PAGE);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
log(`test page served at http://127.0.0.1:${PORT}/`);

// --- 2. launch a Chromium build that still honors --load-extension ----------
// Branded Google Chrome (>=137) IGNORES --load-extension. Use Playwright's
// cached "Google Chrome for Testing" build, which supports it.
const CFG_CANDIDATES = [
  path.join(
    process.env.HOME || "",
    "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ),
  path.join(
    process.env.HOME || "",
    "Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ),
];
const cftBin = CFG_CANDIDATES.find((p) => fs.existsSync(p));
if (!cftBin) {
  throw new Error(
    "No Chrome-for-Testing binary found in ~/Library/Caches/ms-playwright. Run: npx playwright install chromium",
  );
}
log("using browser:", cftBin);

fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  executablePath: cftBin,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--window-position=-32000,-32000", // offscreen: don't disturb the desktop
    "--no-first-run",
  ],
});
log("chrome launched");

// --- 3. find the extension service worker ----------------------------------
let sw = null;
for (let i = 0; i < 40 && !sw; i++) {
  sw = ctx.serviceWorkers().find((s) => s.url().startsWith("chrome-extension://"));
  if (!sw) await new Promise((r) => setTimeout(r, 500));
}
if (!sw) throw new Error("extension service worker did not spawn");
const extId = new URL(sw.url()).host;
log("extension id:", extId, "| sw url:", sw.url());

// Round-trip check: storage must answer (proves the shim + worker boot OK).
const settings = await sw.evaluate(async () => await chrome.storage.local.get(null));
log("sw storage round-trip OK:", JSON.stringify(settings).slice(0, 120));

// --- 4. open the test page ------------------------------------------------
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(1500);
log("test page loaded:", await page.title());

// --- 5. trigger translation from the service worker ------------------------
async function triggerTranslate() {
  return sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url && t.url.includes("127.0.0.1:8741"));
    if (!tab) return { error: "tab not found" };
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "TRIGGER_TRANSLATE",
        payload: { sourceLang: "auto", targetLang: "de" },
      });
      return { tabId: tab.id, resp };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  });
}

let trigger = null;
for (let i = 0; i < 5; i++) {
  trigger = await triggerTranslate();
  if (!trigger.error) break;
  await page.waitForTimeout(1000);
}
log("trigger result:", JSON.stringify(trigger));

// --- 6. wait for injected translations -------------------------------------
let result = { count: 0, samples: [] };
for (let i = 0; i < 30; i++) {
  result = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-xlate]")];
    return {
      count: nodes.length,
      samples: nodes.map((n) => n.textContent.trim()).filter((t) => t.length > 1).slice(0, 8),
    };
  });
  if (result.count >= 6) break; // h1 + 3 p + 3 li = 7 blocks
  await page.waitForTimeout(1000);
}
log(`injected translation nodes: ${result.count}`);
for (const s of result.samples) log("  sample:", s.slice(0, 90));

// --- 7. selection tooltip test ---------------------------------------------
await page.evaluate(() => {
  const p = document.querySelector("#p2");
  const range = document.createRange();
  range.selectNodeContents(p);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
});
let tooltip = null;
for (let i = 0; i < 20; i++) {
  tooltip = await page.evaluate(() => {
    const t = document.querySelector(".xlate-tooltip");
    return t && t.style.display !== "none" ? t.textContent : null;
  });
  if (tooltip && tooltip !== "\u2026") break;
  await page.waitForTimeout(500);
}
log("selection tooltip:", tooltip ? tooltip.slice(0, 90) : "NOT SHOWN");

// --- 8. screenshot -----------------------------------------------------------
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "chrome-e2e.png"), fullPage: true });
log("screenshot:", path.join(SCREENSHOT_DIR, "chrome-e2e.png"));

await ctx.close();
server.close();

const pass = result.count >= 6 && !!tooltip;
console.log(pass ? "\nE2E RESULT: PASS" : "\nE2E RESULT: FAIL");
process.exit(pass ? 0 : 1);
