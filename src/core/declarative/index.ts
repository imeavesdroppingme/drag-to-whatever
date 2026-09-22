export { runDeclarativeProcessor } from "./runtime";
export { toProcessor } from "./toProcessor";
export { validateDeclarativeProcessor } from "./validate";
export {
  installDeclarativeProcessor,
  registerStoredDeclarativeProcessors,
  loadDeclarativeFromStorage,
} from "./storage";
export type { DeclarativeProcessorDef } from "./types";
export { STORAGE_KEY_DECLARATIVE, DECLARATIVE_SCHEMA_VERSION } from "./types";
