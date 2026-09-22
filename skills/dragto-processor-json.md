# DragToWhatever — declarative JSON processors

Use this when adding a **site processor as JSON** (no rebuild for iteration after Load JSON).

Prefer JSON for new sites. Use the [TypeScript skill](dragto-processor-ts.md) only when the DSL cannot express the page.

DragToWhatever turns the page into an artifact; the user **drags** or **copies** it. Destinations are never part of the processor.

Do **not** put site-specific hostnames or selectors into `src/core/**`.

---

## Contract

```json
{
  "schemaVersion": 1,
  "id": "unique-kebab-id",
  "name": "Site → Markdown",
  "matches": ["https://example.com/item/*"],
  "priority": 100,
  "mimeType": "text/markdown",
  "wait": { "selector": "main h1", "timeoutMs": 8000 },
  "before": [],
  "vars": { },
  "output": { }
}
```

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Must be `1` |
| `id` | Unique id (registry key) |
| `name` | Shown in the overlay selector |
| `matches` | URL globs for auto-selection (`*` allowed). Recommendation only — user can still pick manually |
| `priority` | Higher wins among matches (site-specific often `100`; generics use `10`) |
| `mimeType` | Descriptive; V1 drag/copy always uses `text/plain` of `content` |
| `wait` | Optional bounded wait for a selector before extraction |
| `before` | Optional prep: `{ "clickText": "re" }` or `{ "scrollIntoView": "css", "thenWait?": "css" }` (expand/lazy-load comments). Never match Hide/collapse labels |
| `vars` | Named extracted values (pipelines or `mapTree` / `mapAll`) |
| `output` | Template composition into the final string |

---

## Pipeline ops

Each var pipeline is an array of ops. Context starts at `document`, then narrows.

| Op | Effect |
|----|--------|
| `{ "select": "css" }` | `querySelector` in current element/document |
| `{ "selectAll": "css" }` | all matches |
| `{ "first": true }` | first of a list |
| `{ "text": true }` | cleaned textContent |
| `{ "html": true }` | innerHTML |
| `{ "htmlToMarkdown": true }` | HTML → Markdown |
| `{ "attr": "href" }` | attribute |
| `{ "match": "re", "group": 1 }` | regex on string |
| `{ "closest": "css" }` | closest ancestor |
| `{ "previousSibling": true }` / `{ "parent": true }` | DOM walk |
| `{ "selectByText": { "selector", "pattern", "flags?" } }` | first node whose text matches regex |
| `{ "excludeWithin": [ ...pipeline ] }` | from a list, drop nodes inside the region found by pipeline |
| `{ "childContaining": "css" }` | among direct children, first that matches or contains `css` |
| `{ "isInside": "css" }` | `"1"` if current element is inside `css`, else `"0"` (reply depth) |
| `{ "fallback": [ [ops], [ops] ] }` | first non-empty branch (**must preserve Elements**, not stringify, when selecting containers for `mapAll` / `mapTree`) |
| `{ "required": "message" }` | fail processor if empty |
| `{ "const": "$url" }` | literal or `$url` / `$title` |
| `{ "textsJoin": "\n" }` | join text of elements / `p` tags |

---

## `mapTree` (nested DOM trees)

```json
"comments": {
  "from": [ { "select": "main" }, { "select": ".comment-list" } ],
  "mapTree": {
    "node": ".comment",
    "fields": {
      "author": [{ "select": ".author" }, { "text": true }],
      "body": [{ "select": ".body" }, { "htmlToMarkdown": true }]
    },
    "template": "- **{{author}}**\n{{indent body}}",
    "children": { "fromItemChildren": true }
  }
}
```

`{{indent field}}` indents each line by walk depth (two spaces per level).

---

## `mapAll` (flat `querySelectorAll`)

Use when items are not nested as DOM children (e.g. Reddit `depth` attr, YouTube replies, Facebook `Comment by` / `Reply by`):

```json
"comments": {
  "from": [{ "select": "body" }],
  "mapAll": {
    "items": "shreddit-comment",
    "fields": {
      "author": [{ "attr": "author" }],
      "depth": [{ "attr": "depth" }],
      "body": [{ "select": "[slot=\"comment\"]" }, { "htmlToMarkdown": true }]
    },
    "template": "- **{{author}}**\n{{indentBy depth body}}"
  }
}
```

`{{indentBy depthField field}}` indents using a numeric depth field.

---

## Output composition

```json
"output": {
  "join": ["\n\n", [
    { "template": "# {{title}}" },
    { "template": "URL: {{$url}}" },
    { "var": "body" },
    { "if": "comments", "join": ["\n\n", [
      { "template": "## Comments" },
      { "var": "comments" }
    ]]}
  ]]
}
```

- `template` — interpolate `{{var}}` and `{{$url}}` / `{{$title}}`
- `var` — insert a var string
- `join` — `[separator, nodes[]]`
- `if` — skip node when the named var is empty

---

## Install / test

1. Write a `.json` file under `processors/declarative/` (or anywhere).
2. Turn DragToWhatever **ON**.
3. Click **Load JSON** on the overlay and pick the file.
4. Processor is validated, saved in `chrome.storage.local`, registered, and selected.
5. Wait until ready → **Drag** or **Copy**.
6. Reload the extension / new session: stored JSON processors are re-registered automatically.

After changing the **runtime** (`src/core/declarative/**`), rebuild and reload the extension; then re-Load JSON only if the file itself changed.

---

## Limits

- No embedded JavaScript / `eval` in JSON.
- No remote plugin URL fetch.
- No loops beyond `mapTree` / bounded `before` clicks.
- `before.clickText` must not match Hide/collapse controls (runtime also skips those and never re-clicks the same node).
- If the DSL cannot express a site, use a [TypeScript processor](dragto-processor-ts.md).

---

## Examples in repo

- [`processors/declarative/moltbook.json`](../processors/declarative/moltbook.json)
- [`processors/declarative/jira.json`](../processors/declarative/jira.json)
- [`processors/declarative/reddit.json`](../processors/declarative/reddit.json)
- [`processors/declarative/youtube.json`](../processors/declarative/youtube.json)
- [`processors/declarative/facebook.json`](../processors/declarative/facebook.json)

## Related

- [TypeScript processors](dragto-processor-ts.md)
- [README](../README.md)
