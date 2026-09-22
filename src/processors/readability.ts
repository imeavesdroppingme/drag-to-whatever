import { Readability } from "@mozilla/readability";
import type { PageApi } from "../core/page-api";

export type ReadableArticle = {
  title: string;
  content: string;
  textContent: string;
};

/** Clone the document so Readability can mutate freely. */
export function extractReadable(page: PageApi): ReadableArticle | null {
  const clone = page.document.cloneNode(true) as Document;
  const reader = new Readability(clone);
  const article = reader.parse();
  if (!article) return null;
  return {
    title: article.title || page.title,
    content: article.content || "",
    textContent: article.textContent || "",
  };
}
