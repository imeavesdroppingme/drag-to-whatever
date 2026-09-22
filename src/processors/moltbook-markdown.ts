import type { Processor } from "../core/types";
import type { PageApi } from "../core/page-api";
import { waitForSelector } from "../core/wait-for";

/** Observed on live Moltbook post pages (Next.js + Tailwind). */
const POST_ROOT_SELECTOR = "main h1";
const WAIT_MS = 8000;

export const moltbookMarkdownProcessor: Processor = {
  id: "moltbook-markdown",
  name: "Moltbook → Markdown",
  matches: [
    "https://moltbook.com/post/*",
    "https://www.moltbook.com/post/*",
    "http://moltbook.com/post/*",
    "http://www.moltbook.com/post/*",
  ],
  priority: 100,
  async process(page) {
    const root = await waitForSelector(page.document, POST_ROOT_SELECTOR, WAIT_MS);
    if (!root) {
      throw new Error("Could not find post content");
    }

    const main = page.document.querySelector("main");
    if (!main) {
      throw new Error("Could not find post content");
    }

    const titleEl = main.querySelector("h1");
    const title = page.cleanText(titleEl?.textContent ?? page.title);

    const author = extractAuthor(main);
    const submolt = extractSubmolt(main);
    const bodyHtml = extractPostBodyHtml(main);
    const bodyMd = bodyHtml ? page.toMarkdown(bodyHtml) : "";

    const commentsMd = extractCommentsMarkdown(main, page);

    const parts: string[] = [];
    parts.push(`# ${title || "Moltbook post"}`);
    const meta: string[] = [];
    if (author) meta.push(`Author: ${author}`);
    if (submolt) meta.push(`Community: ${submolt}`);
    meta.push(`URL: ${page.url}`);
    parts.push(meta.join("  \n"));
    if (bodyMd) {
      parts.push(bodyMd);
    }
    if (commentsMd) {
      parts.push(`## Comments\n\n${commentsMd}`);
    }

    const content = parts.join("\n\n").trim();
    if (!content) {
      throw new Error("Could not find post content");
    }
    return { content, mimeType: "text/markdown" };
  },
};

function extractAuthor(main: Element): string | null {
  const title = main.querySelector("h1");
  const meta =
    title?.previousElementSibling ??
    title?.parentElement?.querySelector(".text-xs");
  const text = meta?.textContent ?? "";
  const posted = text.match(/Posted by\s+(\S+)/i);
  if (posted?.[1]) return posted[1];

  const userLink =
    title?.parentElement?.querySelector('a[href^="/u/"]') ??
    main.querySelector('a[href^="/u/"]');
  return userLink?.textContent?.trim() || null;
}

function extractSubmolt(main: Element): string | null {
  const link = main.querySelector('a[href^="/m/"]');
  return link?.textContent?.trim() || null;
}

function extractPostBodyHtml(main: Element): string {
  const commentsSection = findCommentsSection(main);
  for (const prose of Array.from(main.querySelectorAll(".prose"))) {
    if (commentsSection?.contains(prose)) continue;
    return prose.innerHTML;
  }
  return "";
}

function findCommentsHeading(main: Element): HTMLHeadingElement | null {
  return (
    Array.from(main.querySelectorAll("h2")).find((h) =>
      /Comments/i.test(h.textContent ?? ""),
    ) ?? null
  );
}

function findCommentsSection(main: Element): Element | null {
  const h2 = findCommentsHeading(main);
  return h2?.closest(".mt-6") ?? h2?.parentElement ?? null;
}

function extractCommentsMarkdown(main: Element, page: PageApi): string {
  const commentsH2 = findCommentsHeading(main);
  if (!commentsH2) return "";

  const section = commentsH2.closest(".mt-6") ?? commentsH2.parentElement;
  if (!section) return "";

  // Comment list is typically the bordered container after the header row
  const list =
    Array.from(section.children).find(
      (c) =>
        c !== commentsH2.parentElement &&
        c.querySelector("div.py-2") &&
        !c.querySelector("h2"),
    ) ?? section.querySelector("div.bg-\\[\\#1a1a1b\\], div.rounded-lg");

  if (!list) return "";

  const lines: string[] = [];
  walkCommentNodes(list, page, 0, lines);
  return lines.join("\n\n").trim();
}

/**
 * Walk comment wrappers. Top-level children are comment nodes; nested
 * wrappers with additional div.py-2 become deeper replies when present.
 */
function walkCommentNodes(
  container: Element,
  page: PageApi,
  depth: number,
  out: string[],
): void {
  for (const child of Array.from(container.children)) {
    const commentEl = child.matches("div.py-2")
      ? child
      : child.querySelector(":scope > div.py-2");

    if (commentEl) {
      const md = formatComment(commentEl, page, depth);
      if (md) out.push(md);

      // Nested replies: other descendant py-2 blocks under this child,
      // excluding the comment itself — only direct nested wrapper children.
      for (const nested of Array.from(child.children)) {
        if (nested === commentEl) continue;
        if (nested.querySelector("div.py-2") || nested.matches("div.py-2")) {
          walkCommentNodes(
            nested.matches("div.py-2") ? nested.parentElement! : nested,
            page,
            depth + 1,
            out,
          );
        }
      }
      continue;
    }

    if (child.querySelector("div.py-2")) {
      walkCommentNodes(child, page, depth, out);
    }
  }
}

function formatComment(commentEl: Element, page: PageApi, depth: number): string | null {
  const authorLink =
    commentEl.querySelector('a[href^="/u/"]') ??
    commentEl.querySelector("a.font-medium, a[class*='font-medium']");
  const author = page.cleanText(authorLink?.textContent ?? "unknown");
  const prose = commentEl.querySelector(".prose");
  const body = prose
    ? page.toMarkdown(prose.innerHTML)
    : page.cleanText(
        Array.from(commentEl.querySelectorAll("p"))
          .map((p) => p.textContent ?? "")
          .join("\n"),
      );

  if (!author && !body) return null;

  const indent = "  ".repeat(depth);
  const heading = `${indent}- **${author}**`;
  if (!body) return `${heading}: _(empty)_`;

  const bodyLines = body
    .split("\n")
    .map((line) => `${indent}  ${line}`)
    .join("\n");
  return `${heading}\n${bodyLines}`;
}
