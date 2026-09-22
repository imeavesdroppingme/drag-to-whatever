import type { Processor } from "./types";
import { FALLBACK_PROCESSOR_ID } from "./types";
import { urlMatches } from "./match";

const processors = new Map<string, Processor>();

export function registerProcessor(processor: Processor): void {
  processors.set(processor.id, processor);
}

export function getProcessor(id: string): Processor | undefined {
  return processors.get(id);
}

export function listProcessors(): Processor[] {
  return Array.from(processors.values()).sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return a.id.localeCompare(b.id);
  });
}

export function matchingProcessors(url: string): Processor[] {
  return listProcessors().filter((p) => urlMatches(url, p.matches));
}

/** Highest priority match; tie-break by id; else fallback generic-markdown. */
export function autoSelectProcessor(url: string): Processor {
  const matches = matchingProcessors(url);
  if (matches.length > 0) {
    return matches[0]!;
  }
  const fallback = processors.get(FALLBACK_PROCESSOR_ID);
  if (!fallback) {
    throw new Error("Fallback processor generic-markdown is not registered");
  }
  return fallback;
}
