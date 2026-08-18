# Improvements Pass — 2026-08-18 (v0.2.0)

## Findings (from code review + exploratory QA)

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| 1 | Switching language + Translate did NOT re-translate: already-translated blocks were filtered out (`data-xlate-orig`), old translations stayed | content.js `translatePage()` filter | High (functional bug) |
| 2 | `autoTranslateDomains` existed in settings/storage since the design spec but NO code ever used it — no UI, no load trigger | storage.js default + zero usages | High (missing feature) |
| 3 | No timeout on provider HTTP calls — a dead endpoint blocks the whole page translate forever (`translating` flag stuck) | all 4 adapters: bare `fetch()` | Medium |
| 4 | Toolbar badge (spec: "badge counts errors") never implemented | worker.js had no badge code | Low |
| 5 | Keyboard shortcut shown in popup UI (`⌥A` kbd) but never wired | popup.html kbd, no commands in manifest | Medium (misleading UI) |
| 6 | In-memory translate cache had no cap — grows forever on infinite-scroll pages | dispatch.js `cache.set` unconditional | Low |
| 7 | Popup threw unhandled promise rejections on chrome:// pages (no receiver for tabs.sendMessage) | popup.js translate/mode handlers | Low |
| 8 | Settings had no import/export (design spec listed it) | settings.js | Medium |
| 9 | No way to see/remove auto-translate sites anywhere | — (consequence of #2) | Low |

## Decisions

| Decision | Alternatives | Why chosen |
|----------|-------------|------------|
| Re-translate = always clear injected nodes first | per-block replace tracking | Simpler, idempotent; cache makes re-translation cheap (no API calls for identical text) |
| Auto-translate trigger in content script startup via GET_SETTINGS | SW-side tabs.onUpdated injection | Works on both browsers, no extra permissions, survives SW restarts |
| Shortcut via manifest `commands` (Alt+A), worker onCommand → active tab | content-script keydown listener | Browser-level = no conflict with page shortcuts, user-rebindable in chrome://extensions/shortcuts |
| 30s AbortSignal.timeout per provider call | Retry logic | Timeout+visible ⚠ is enough for v1; retries belong to a later pass |
| Badge "!" on any failed batch, cleared on success | numeric error count | Error counts across batches are noise; a binary signal is actionable |
| Cache cap 1000, evict oldest | LRU | FIFO-eviction is 3 lines, sufficient for nav/repeated-string hits |
| Popup/settings errors shown inline (status line / alert) | silent catch | User must see WHY translate did nothing on chrome:// pages |
| Import replaces provider list (+langs/default/domains), export with optional keys | merge-by-id | Predictable, matches "share a config" use case |
| Auto-translate managed via popup checkbox (add) + settings list (remove) | domain input in settings | Popup is where the user is when they decide "always this site" |

## Shipped (v0.2.0)

- Fix: re-translate clears old translations (bug #1)
- Feature: "Always translate this site" (popup checkbox) + auto-translate on page load + settings list with remove buttons (#2, #9)
- Feature: keyboard shortcut Alt+A / ⌥A → translate current page, rebindable (#5)
- Robustness: 30s timeouts on all adapters with friendly error (#3), cache cap (#6)
- Signal: toolbar badge "!" on translation errors (#4)
- UX: popup status line for unreachable pages (#7)
- Feature: settings Import/Export config JSON, optional API keys (#8)
- Version 0.1.0 → 0.2.0

## Verification

- 61/61 unit tests (added: domains matching, cache cap)
- E2E PASS: initial translate, selection tooltip, re-translate (de→en replaces nodes), auto-translate on load (7 nodes, zero clicks), badge state, settings labels + model suggestions

## Deferred (deliberately, YAGNI)

- Retry/backoff for provider failures
- Context menu "Translate this page"
- Markup-preserving in-block translation (v2 per original spec)
- PDF / subtitle translation (separate project per spec)
- UI i18n of the extension itself
