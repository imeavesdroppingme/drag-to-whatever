import type { Processor } from "../core/types";
import { extractReadable } from "./readability";

export const genericHtmlProcessor: Processor = {
  id: "generic-html",
  name: "Generic → HTML",
  matches: ["*"],
  priority: 10,
  async process(page) {
    const article = extractReadable(page);
    if (article?.content?.trim()) {
      const title = article.title || page.title;
      const content = title
        ? `<article><h1>${escapeHtml(title)}</h1>${article.content}</article>`
        : article.content;
      return { content, mimeType: "text/html" };
    }
    const body = page.document.body?.innerHTML?.trim();
    if (!body) {
      throw new Error("Could not extract HTML content");
    }
    return { content: body, mimeType: "text/html" };
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
