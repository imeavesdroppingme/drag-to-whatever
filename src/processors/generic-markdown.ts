import type { Processor } from "../core/types";
import { extractReadable } from "./readability";

export const genericMarkdownProcessor: Processor = {
  id: "generic-markdown",
  name: "Generic → Markdown",
  matches: ["*"],
  priority: 10,
  async process(page) {
    const article = extractReadable(page);
    if (!article || !article.content) {
      const bodyHtml = page.document.body?.innerHTML ?? "";
      const md = page.toMarkdown(bodyHtml);
      if (!md) {
        throw new Error("Could not extract readable content");
      }
      return { content: `# ${page.title}\n\n${md}`, mimeType: "text/markdown" };
    }
    const md = page.toMarkdown(article.content);
    const title = article.title || page.title;
    const content = title ? `# ${title}\n\n${md}` : md;
    return { content, mimeType: "text/markdown" };
  },
};
