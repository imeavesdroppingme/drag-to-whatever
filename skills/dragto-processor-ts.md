# DragToWhatever — TypeScript processors

Use this when adding a **built-in processor in TypeScript** (rebuild required). Prefer [declarative JSON](dragto-processor-json.md) for new sites unless the DSL cannot express the page.

DragToWhatever turns the page into an artifact; the user **drags** or **copies** it. Destinations are never part of the processor.

Do **not** put site-specific hostnames or selectors into `src/core/**` — keep that logic in the processor file.

---

## Contract

```ts
type Artifact = { content: string; mimeType: string };

type Processor = {
  id: string;
  name: string;
  matches: string[];
  priority?: number;
  process(page: PageApi): Promise<Artifact>;
};
```

| Field | Meaning |
|-------|---------|
| `id` | Unique registry key |
| `name` | Overlay selector label |
| `matches` | URL globs (`*` allowed) for auto-selection |
| `priority` | Higher wins (site-specific often `100`; generics `10`) |
| `process` | Extract → return `{ content, mimeType }` |

V1 drag/copy always sends `text/plain` of `artifact.content`.

---

## PageApi

```
page.url | page.title | page.document
page.querySelector / querySelectorAll
page.text / page.html / page.toMarkdown / page.cleanText
```

Bounded SPA wait: `waitForSelector(doc, selector, timeoutMs)` from `src/core/wait-for.ts`.

---

## Register

1. Add `src/processors/your-processor.ts`
2. `registerProcessor(...)` in `src/processors/index.ts`
3. `npm run build` and reload the unpacked extension (`dist/`)

---

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
    return { content: `# ${title}\n\n${md}`.trim(), mimeType: "text/markdown" };
  },
};
```

Reference built-in: [`src/processors/moltbook-markdown.ts`](../src/processors/moltbook-markdown.ts).

---

## Lifecycle constraints

- Prepare/cache **before** drag; never await work inside `dragstart`.
- Use bounded waits for SPA late render — not continuous scanning.
- URL change clears page-scoped manual override and re-prepares.
- Manual processor choice is page-scoped (tab + URL).

---

## When to use TS vs JSON

| Use JSON | Use TypeScript |
|----------|----------------|
| Selectors + templates + mapTree/mapAll enough | Complex DOM walks, custom nesting, or logic the DSL lacks |
| Iterate via **Load JSON** without rebuild | Core built-ins shipped with the extension |
| User-distributable site packs | Shared helpers already in `src/processors/` |

---

## Related

- [Declarative JSON processors](dragto-processor-json.md)
- [README](../README.md)
