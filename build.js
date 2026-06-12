// Bundles the extension into dist/ as Safari-compatible IIFE files (no ES modules),
// then copies static assets (HTML, CSS, manifest) and rewrites manifest paths.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const SRC = "src";
const OUT = "dist";

// Entry points that contain JS logic. Each becomes a single self-contained IIFE.
const ENTRIES = {
  "background/worker.js": "src/background/worker.js",
  "content/content.js": "src/content/content.js",
  "content/selection.js": "src/content/selection.js",
  "popup/popup.js": "src/popup/popup.js",
  "settings/settings.js": "src/settings/settings.js",
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: Object.entries(ENTRIES).map(([out, inp]) => ({ in: inp, out: out.replace(/\.js$/, "") })),
  outdir: OUT,
  bundle: true,
  format: "iife",
  target: "safari16",
  logLevel: "info",
});

// Copy static files (HTML + CSS) preserving structure.
const STATIC = [
  "popup/popup.html",
  "popup/popup.css",
  "settings/settings.html",
  "settings/settings.css",
  "content/content.css",
];
for (const rel of STATIC) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (rel.endsWith(".html")) {
    // Bundled JS is IIFE, not a module — strip type="module" so Safari loads it.
    const html = fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\s+type="module"/g, "");
    fs.writeFileSync(dest, html);
  } else {
    fs.copyFileSync(path.join(SRC, rel), dest);
  }
}

// Copy icons (PNG only — the SVG source stays out of the bundle).
fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });
for (const f of fs.readdirSync("icons")) {
  if (f.endsWith(".png")) fs.copyFileSync(path.join("icons", f), path.join(OUT, "icons", f));
}

// Rewrite manifest: strip "type: module" and point paths at dist-relative files.
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
manifest.background = { service_worker: "background/worker.js" };
manifest.action.default_popup = "popup/popup.html";
manifest.options_ui.page = "settings/settings.html";
manifest.content_scripts[0].js = ["content/content.js", "content/selection.js"];
manifest.content_scripts[0].css = ["content/content.css"];
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("\nBuilt to dist/ (Safari-compatible, no ES modules).");
