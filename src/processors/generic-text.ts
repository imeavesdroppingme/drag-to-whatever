import type { Processor } from "../core/types";
import { extractReadable } from "./readability";

export const genericTextProcessor: Processor = {
  id: "generic-text",
  name: "Generic → Text",
  matches: ["*"],
  priority: 10,
  async process(page) {
    const article = extractReadable(page);
    if (article?.textContent?.trim()) {
      const title = article.title || page.title;
      const body = page.cleanText(article.textContent);
      const content = title ? `${title}\n\n${body}` : body;
      return { content, mimeType: "text/plain" };
    }
    const body = page.text(page.document.body);
    if (!body) {
      throw new Error("Could not extract text content");
    }
    const content = page.title ? `${page.title}\n\n${body}` : body;
    return { content, mimeType: "text/plain" };
  },
};
