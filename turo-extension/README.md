# Lightning Fleet Tracker v2 — Chrome Extension

## What's New in v2

8 critical bug fixes over v1:

1. **Separate pipeline** — writes to `live-captures.json`, never touches `data.json`
2. **No webRequest permission** — cleaner manifest, less intrusive
3. **Content-based detection** — captures ALL JSON responses with relevant Turo data, not just pattern-matched URLs. Full GraphQL support.
4. **Raw JSON pass-through** — no field extraction in the extension; the cron job handles all mapping
5. **Unicode-safe base64** — `TextEncoder`/`TextDecoder` replaces broken `btoa(unescape(...))`
6. **Incremental push** — only pushes captures since `lastPushedCaptureId`, skips when nothing new
7. **Proper state persistence** — all state in `chrome.storage.local`, survives service worker death
8. **SHA conflict retry** — 3 attempts with re-fetch on 409 conflicts

## Install (Developer Mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `turo-extension/` folder
5. Pin the extension for easy access

## Setup

1. Click the extension icon
2. Enter a **GitHub Personal Access Token** (needs `repo` scope for the fleet-dashboard repo)
3. Click **Save Token**
4. Browse Turo — the extension automatically captures relevant API/GraphQL responses

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Turo.com tab   │     │  Background      │     │  GitHub Repo         │
│                 │     │  Service Worker  │     │                      │
│  content.js     │     │                  │     │  live-captures.json  │
│  intercepts     │────▶│  stores captures │────▶│  (raw captures)      │
│  fetch + XHR    │ msg │  pushes every 5m │ PUT │                      │
│                 │     │                  │     │  data.json           │
│  detects data   │     │  dedup + cleanup │     │  (cron-processed)    │
│  by CONTENT     │     │                  │     │                      │
└─────────────────┘     └──────────────────┘     └──────────────────────┘
                                                      ▲
                              ┌───────────────────────┘
                              │  Cron Job (separate)
                              │  reads live-captures.json
                              │  processes + extracts fields
                              │  merges into data.json
                              └──────────────────────
```

### Two Separate Pipelines

| File | Written by | Purpose |
|------|-----------|---------|
| `live-captures.json` | Chrome extension | Raw API captures (append-only) |
| `data.json` | Cron job | Processed, structured fleet data |

This separation ensures zero corruption risk — the extension and cron job never write to the same file.

### How Content Detection Works (Fix 3)

The extension does NOT rely on URL pattern matching alone. Instead:

1. Intercepts **all** fetch and XHR responses from `turo.com` domains
2. Parses each JSON response
3. Checks if the response body contains any of: `listing`, `vehicle`, `availability`, `calendar`, `booked`, `price`, `dailyRate`, `search`, `trip`, `rental`, `host`, `delivery`
4. If found → captures the **raw** JSON and sends to background
5. Extracts GraphQL operation names from request bodies

### live-captures.json Format

```json
{
  "lastUpdated": "2026-06-16T13:25:00-07:00",
  "captures": [
    {
      "id": "cap-42-1718555100000",
      "idNum": 42,
      "timestamp": 1718555100000,
      "url": "https://api.turo.com/graphql",
      "type": "graphql",
      "pageUrl": "https://turo.com/cars/rent/united-states/seattle-wa/tesla-model-3/123456",
      "operationName": "GetListingDetails",
      "data": {
        "data": {
          "listing": { ... }
        }
      }
    }
  ]
}
```

### Capture Types

| Type | When |
|------|------|
| `graphql` | Response from a GraphQL endpoint with matching operation name or `{ data: {...} }` shape |
| `listing` | REST URL contains "listing" |
| `availability` | REST URL contains "availability" or "calendar" |
| `search` | REST URL contains "search" |
| `api` | Other API responses with relevant data keywords |

## Files

```
turo-extension/
├── manifest.json    — MV3 manifest (storage, alarms, notifications only)
├── config.js        — Configuration constants + keyword filters
├── content.js       — fetch/XHR interceptor with content-based detection
├── background.js    — Service worker: storage, dedup, incremental push, SHA retry
├── popup.html       — Extension popup UI (dark theme)
├── popup.js         — Popup logic + status display
├── icons/           — Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md        — This file
```

## Debugging

### Content Script Logs
Open Turo in Chrome → DevTools Console → look for:
- `[Lightning Fleet] fetch → <url>` — every intercepted fetch URL
- `[Lightning Fleet] XHR → <url>` — every intercepted XHR URL
- `[Lightning Fleet] Capture [graphql] <url>` — captured response
- `[Lightning Fleet] Content script v2 loaded` — script initialized

### Background Service Worker Logs
1. Go to `chrome://extensions/`
2. Find "Lightning Fleet Tracker"
3. Click **"Service Worker"** (or "Inspect views: service worker")
4. Console shows:
   - `[Lightning Fleet BG] Capture #N stored [type]`
   - `[Lightning Fleet BG] Pushed N captures to GitHub`
   - `[Lightning Fleet BG] No new captures since last push — skipping`
   - `[Lightning Fleet BG] SHA conflict on attempt N, re-fetching...`

### Popup
- Shows live capture count, last capture URL, push status
- "Push Now" button for manual push
- "View Logs" button opens extensions page
- Refreshes every 5 seconds

## Safety

- The monkey-patch **never modifies** requests or responses
- `fetch`: clones the response before reading — original stream untouched
- `XHR`: reads `responseText` after load — doesn't intercept the stream
- All interception code wrapped in `try/catch`
- Original `fetch`/`XHR` always called normally first
- All promises returned to the caller — Turo's app works exactly as before

## Key Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Target file | `data.json` | `live-captures.json` |
| Permissions | includes `webRequest` | `storage`, `alarms`, `notifications` only |
| Detection | URL pattern matching | URL + response content keywords |
| GraphQL | Not supported | Full support (operation names, `{ data }` shapes) |
| Data sent | Extracted fields only | Raw JSON (cron handles extraction) |
| Base64 | `btoa(unescape(encode))` — breaks on Unicode | `TextEncoder` — safe for all characters |
| Push | Re-pushes everything | Incremental — only new captures since last push |
| State | In-memory variables | All state persisted to `chrome.storage.local` |
| SHA conflicts | Single attempt fails | 3 retries with re-fetch |
| Dedup | None | URL + timestamp (5s window) |
| Cleanup | None | Hourly removal of captures >7 days old |
