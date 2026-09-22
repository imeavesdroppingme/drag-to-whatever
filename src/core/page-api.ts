import TurndownService from "turndown";

export type PageApi = {
  readonly url: string;
  readonly title: string;
  readonly document: Document;
  querySelector(selector: string): Element | null;
  querySelectorAll(selector: string): Element[];
  text(el?: Element | null): string;
  html(el?: Element | null): string;
  toMarkdown(html: string): string;
  cleanText(text: string): string;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export function createPageApi(doc: Document = document): PageApi {
  return {
    get url() {
      return doc.defaultView?.location.href ?? location.href;
    },
    get title() {
      return doc.title;
    },
    get document() {
      return doc;
    },
    querySelector(selector) {
      return doc.querySelector(selector);
    },
    querySelectorAll(selector) {
      return Array.from(doc.querySelectorAll(selector));
    },
    text(el) {
      const target = el ?? doc.body;
      return target ? cleanText(target.textContent ?? "") : "";
    },
    html(el) {
      const target = el ?? doc.documentElement;
      return target ? target.innerHTML : "";
    },
    toMarkdown(html) {
      return turndown.turndown(html).trim();
    },
    cleanText,
  };
}

export function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
