import { registerProcessor } from "../core/registry";
import { genericMarkdownProcessor } from "./generic-markdown";
import { genericTextProcessor } from "./generic-text";
import { genericHtmlProcessor } from "./generic-html";
import { moltbookMarkdownProcessor } from "./moltbook-markdown";

export function registerBuiltInProcessors(): void {
  registerProcessor(genericMarkdownProcessor);
  registerProcessor(genericTextProcessor);
  registerProcessor(genericHtmlProcessor);
  registerProcessor(moltbookMarkdownProcessor);

  // Future: build-time user processors under ./user/ can register here.
}

export {
  genericMarkdownProcessor,
  genericTextProcessor,
  genericHtmlProcessor,
  moltbookMarkdownProcessor,
};
