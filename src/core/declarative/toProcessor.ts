import type { Processor } from "../types";
import type { DeclarativeProcessorDef } from "./types";
import { runDeclarativeProcessor } from "./runtime";

export function toProcessor(def: DeclarativeProcessorDef): Processor {
  return {
    id: def.id,
    name: def.name,
    matches: def.matches,
    priority: def.priority ?? 0,
    async process(page) {
      return runDeclarativeProcessor(def, page);
    },
  };
}
