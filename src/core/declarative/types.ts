import type { Artifact } from "../types";

export const DECLARATIVE_SCHEMA_VERSION = 1;
export const STORAGE_KEY_DECLARATIVE = "declarativeProcessors";

/** One step in an extraction pipeline. Context flows: Element | Element[] | string | null */
export type Op =
  | { select: string }
  | { selectAll: string }
  | { text: true }
  | { html: true }
  | { htmlToMarkdown: true }
  | { attr: string }
  | { match: string; group?: number }
  | { closest: string }
  | { selectByText: { selector: string; pattern: string; flags?: string } }
  | { excludeWithin: Op[] }
  | { childContaining: string }
  | { first: true }
  | { previousSibling: true }
  | { parent: true }
  | { required: string }
  | { const: string }
  | { textsJoin: string }
  /** "1" if element.closest(selector) matches, else "0" — for reply depth */
  | { isInside: string }
  | { fallback: Op[][] };

export type Pipeline = Op[];

export type MapTreeSpec = {
  /** Selector for each direct child item under the container (default: ":scope > *") */
  item?: string;
  /** Selector for the comment/node element inside an item */
  node: string;
  fields: Record<string, Pipeline>;
  /** Template per node. Supports {{field}}, {{indent field}} */
  template: string;
  children?: { fromItemChildren: true };
};

export type VarDef =
  | Pipeline
  | {
      from: Pipeline;
      mapTree: MapTreeSpec;
    }
  | {
      from: Pipeline;
      mapAll: MapAllSpec;
    };

/** Flat list via querySelectorAll under `from` result. */
export type MapAllSpec = {
  items: string;
  fields: Record<string, Pipeline>;
  /** Supports {{field}}, {{indent field}}, {{indentBy depthField field}} */
  template: string;
};

export type OutputNode =
  | { template: string; if?: string }
  | { var: string; if?: string }
  | { join: [string, OutputNode[]]; if?: string };

export type DeclarativeProcessorDef = {
  schemaVersion: number;
  id: string;
  name: string;
  matches: string[];
  priority?: number;
  mimeType?: string;
  wait?: { selector: string; timeoutMs?: number };
  /** Optional UI actions before extraction (e.g. expand “more comments”). */
  before?: BeforeAction[];
  vars: Record<string, VarDef>;
  output: OutputNode;
};

export type BeforeAction =
  | {
      /** Regex matched against button/link visible text */
      clickText: string;
      flags?: string;
      max?: number;
      delayMs?: number;
    }
  | {
      /** Scroll first matching selector into view (lazy-loaded sections). */
      scrollIntoView: string;
      delayMs?: number;
      /** After scroll, wait for this selector (e.g. comment threads). */
      thenWait?: string;
      timeoutMs?: number;
    };

export type DeclarativeRunResult = Artifact;
