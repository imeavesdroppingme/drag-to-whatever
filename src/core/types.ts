import type { PageApi } from "./page-api";

/** Internal content kind. V1 drag always uses text/plain regardless. */
export type Artifact = {
  content: string;
  mimeType: string;
};

export type Processor = {
  id: string;
  name: string;
  /** Glob patterns, e.g. "*" or "https://moltbook.com/post/*" */
  matches: string[];
  /** Higher wins. Default 0. */
  priority?: number;
  process(page: PageApi): Promise<Artifact>;
};

export type PrepareStatus =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "ready"; artifact: Artifact }
  | { kind: "error"; message: string };

export const FALLBACK_PROCESSOR_ID = "generic-markdown";
