# Bilingual Translate

Free, open-source browser extension for bilingual inline web-page translation
(Immersive Translate style). Bring your own API key for any provider, or use the
free keyless default. No Pro tier, no account.

**Targets: Safari (native app shell) and Chrome (unpacked extension).**
One codebase — the build injects a `browser → chrome` shim so both work.

## Features
- Bilingual inline translation: translated text under each paragraph, original kept.
- Selection translate: select text → tooltip translation.
- Any provider via adapters: keyless (Google), OpenAI-compatible (OpenAI/DeepSeek/
  Groq/OpenRouter/Ollama), DeepL, Google Cloud Translate, Anthropic.
- Add custom providers (URL + key + model).

## Develop / run locally (Safari)
1. `cd extension && npm install && npm test`
2. Bundle for Safari (esbuild → IIFE, no ES modules): `npm run build` → outputs `dist/`.
3. Generate the Safari app wrapper from the bundle:
   `xcrun safari-web-extension-converter extension/dist --project-location xcode --app-name "Bilingual Translate" --bundle-identifier com.timur.bilingualtranslate --macos-only --no-open`
4. The converter sets the parent-app and extension bundle IDs inconsistently; make the
   app ID equal the extension's prefix. In `xcode/Bilingual Translate/Bilingual Translate.xcodeproj/project.pbxproj`,
   set the app target's `PRODUCT_BUNDLE_IDENTIFIER` to `com.timur.bilingualtranslate`
   (the extension is `com.timur.bilingualtranslate.Extension`).
5. Build (ad-hoc signed, for local use):
   `xcodebuild -project "xcode/Bilingual Translate/Bilingual Translate.xcodeproj" -scheme "Bilingual Translate" -configuration Debug -derivedDataPath build CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO`
6. Open the built `Bilingual Translate.app` once (registers the extension).
7. Safari → Settings → Advanced → "Show features for web developers".
8. Safari → Develop → Allow Unsigned Extensions; enable the extension in Settings → Extensions.

### Why bundle?
Safari (current version) does not support `"type": "module"` service workers / module
content scripts in the manifest. `npm run build` bundles each entry into a single
self-contained IIFE and rewrites the manifest, so it loads in Safari. The source stays
ES-modules (and is unit-tested as such); only the shipped `dist/` is bundled.

### Chrome
The same `dist/` output runs in Chrome. The build injects
`globalThis.browser ??= globalThis.chrome;` as a banner into every bundle, because
Chrome (unlike Safari/Firefox) has no `browser` global. Load `dist/` as an unpacked
extension via `chrome://extensions` → Developer mode → Load unpacked. See
`../CHROME.md` in the project root for the full runbook and the automated E2E test
(`../e2e/chrome-e2e.mjs`).

### Known cosmetic gap
No custom toolbar icon yet — Safari shows a default puzzle-piece icon. Functionality
is unaffected. Add PNGs to the Xcode `AppIcon`/extension icon set to polish.

## Architecture
- `src/adapters/` — provider adapters behind one `translate(blocks, src, tgt, config)` interface.
- `src/segment/` — DOM → translatable block list (pure, jsdom-tested).
- `src/background/` — service worker: dispatch, per-provider cache, settings storage.
- `src/content/` — segment → translate → inject bilingual nodes; mutation observer; selection tooltip.
- `src/popup/`, `src/settings/` — toolbar popup and config UI.

## Tests
`npm test` runs the Vitest suite (adapters, segmentation, dispatch, injection). The
pure logic is fully unit-tested without a browser; injection/observers and the final
flow are verified in Safari.

## License
MIT
