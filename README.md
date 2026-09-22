# DragToWhatever

Chrome extension (Manifest V3) that transforms the current page with a selectable **processor** and lets you **drag** the result anywhere as `text/plain`.

Author: imeavesdropping \<imeavesdropping.me@gmail.com\>  
License: GPL-3.0

## How it works

1. Click the toolbar icon → session **ON** (badge shows `ON`)
2. A small floating overlay appears on the page
3. Pick a processor (or keep the automatic suggestion)
4. Wait until status is **Ready**
5. Drag the handle into any app that accepts text
6. Click the toolbar icon again → session **OFF** (overlays removed; no further injection)

Closing Chrome clears the session; DragToWhatever starts **OFF**.

There are no destination integrations. The OS/browser handles the drop target.

## Built-in processors

| Processor | Role |
|-----------|------|
| Moltbook → Markdown | Site-structured post + comments (priority 100) |
| Generic → Markdown | Readability + Turndown fallback |
| Generic → Text | Clean plain text |
| Generic → HTML | Readable HTML fragment |

Manual processor choice is **page-scoped** (tab + URL). Navigating to another page clears the override and re-runs automatic selection.

## Develop

```bash
npm install
npm run build
```

Load unpacked in Chrome:

1. `chrome://extensions`
2. Enable Developer mode
3. **Load unpacked** → select the `dist/` folder

Watch rebuild:

```bash
npm run build && vite build --mode content --watch
```

(or `npm run dev` after the initial background build)

## Permissions

- `storage` — session ON/OFF (`chrome.storage.session`)
- `scripting` — register/inject the overlay content script while ON
- `tabs` — inject/teardown across open tabs
- Host access to `http(s)://*/*` — overlay on the current and subsequently navigated pages during a session

Page content stays local. No analytics, telemetry, or backend.

## Custom processors

Both paths are supported. Prefer JSON for new sites.

| Path | Skill | How |
|------|-------|-----|
| **Declarative JSON** (preferred) | [skills/dragto-processor-json.md](skills/dragto-processor-json.md) | Write a `.json` file → overlay **Load JSON**. Stored in `chrome.storage.local`, re-registered on session start. |
| **TypeScript** | [skills/dragto-processor-ts.md](skills/dragto-processor-ts.md) | Implement `Processor` under `src/processors/`, register in `src/processors/index.ts`, then `npm run build` and reload the extension. |

Index: [skills/dragto-processor.md](skills/dragto-processor.md).

Example JSON processors in the repo ([`processors/declarative/`](processors/declarative/)):

| File | Site |
|------|------|
| [moltbook.json](processors/declarative/moltbook.json) | Moltbook posts |
| [jira.json](processors/declarative/jira.json) | Jira issues |
| [reddit.json](processors/declarative/reddit.json) | Reddit threads |
| [youtube.json](processors/declarative/youtube.json) | YouTube videos |
| [facebook.json](processors/declarative/facebook.json) | Facebook posts / groups |

## Support

If you like this extension, leave a short message at [imeavesdropping.com](https://imeavesdropping.com).

Privacy policy: [PRIVACY.md](PRIVACY.md).
