# DragToWhatever processor skill

Use this document to write a processor for the **DragToWhatever** Chrome extension.

DragToWhatever transforms the current page into an artifact, then lets the user **drag** that artifact into any app. Destinations are never part of the processor.

## Contract

```ts
type Artifact = {
  content: string;
  mimeType: string; // descriptive only in V1
};

type Processor = {
  id: string;           // unique, kebab-case
  name: string;         // shown in the overlay selector
  matches: string[];    // URL globs for auto-selection (* allowed)
  priority?: number;    // higher wins; generics use 10; site-specific often 100
  process(page: PageApi): Promise<Artifact>;
};
```

### Matching

- `matches` is a **recommendation** for automatic selection, not an access control.
- Users may manually select any processor on any page.
- Auto-select: highest `priority` among matching processors; tie-break by `id`; else `generic-markdown`.

Examples:

```ts
matches: ["*"]
matches: ["https://example.com/item/*", "https://www.example.com/item/*"]
```

### V1 drag payload

Regardless of `mimeType`, the overlay always does:

```ts
dataTransfer.setData("text/plain", artifact.content)
```

Put the final text the user should drop (Markdown, plain text, HTML source, etc.) in `content`.

## PageApi

```ts
page.url
page.title
page.document

page.querySelector(selector)
page.querySelectorAll(selector)

page.text(el?)          // cleaned text
page.html(el?)          // innerHTML
page.toMarkdown(html)   // HTML → Markdown helper
page.cleanText(text)
```

Work on the **already rendered DOM**. Do not call remote browsers, LLMs, or destination APIs.

## Lifecycle

1. Session ON → overlay mounts
2. Processor selected (auto or manual)
3. `process()` runs and the result is **cached**
4. User drags → `dragstart` synchronously reads the cache

If the page is a SPA and content appears late, use a **bounded** wait for a known root selector, then process once. Do not continuously reparse on every mutation.

## Install / packaging

V1 loads processors at **build time**.

1. Add a file under `src/processors/your-processor.ts`
2. Export a `Processor` object
3. Register it in `src/processors/index.ts` via `registerProcessor(...)`
4. Rebuild the extension

Optional future layout: drop files under `src/processors/user/` and register them from `index.ts`. Runtime `eval` of arbitrary JS is not supported (Chrome extension CSP).

## Example skeleton

```ts
import type { Processor } from "../core/types";
import { waitForSelector } from "../core/wait-for";

export const exampleProcessor: Processor = {
  id: "example-md",
  name: "Example → Markdown",
  matches: ["https://example.com/posts/*"],
  priority: 100,
  async process(page) {
    const root = await waitForSelector(page.document, "article.post", 8000);
    if (!root) throw new Error("Could not find post content");

    const title = page.cleanText(root.querySelector("h1")?.textContent ?? page.title);
    const body = root.querySelector(".content");
    const md = body ? page.toMarkdown(body.innerHTML) : page.text(root);

    return {
      content: `# ${title}\n\n${md}`.trim(),
      mimeType: "text/markdown",
    };
  },
};
```

## Best practices

- Prefer durable semantic selectors (`article`, `main h1`, stable `data-*`) over brittle generated class soup when possible.
- Preserve structure that matters for LLMs (headings, lists, nested comments).
- Fail with a short human-readable error if the expected root is missing.
- Keep processors self-contained; never hard-code site logic into the DragToWhatever core.
- Do not send page content to a server from built-in processors.

## Limits

- No marketplace, signing, or remote plugin loading in V1
- No target-specific integrations (ChatGPT, Slack, …)
- No clipboard-first UX (drag is primary)
- Session state is temporary (`chrome.storage.session`); Chrome restart → OFF
