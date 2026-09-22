import { registerProcessor } from "../registry";
import type { DeclarativeProcessorDef } from "./types";
import { STORAGE_KEY_DECLARATIVE } from "./types";
import { validateDeclarativeProcessor } from "./validate";
import { toProcessor } from "./toProcessor";

export async function loadDeclarativeFromStorage(): Promise<DeclarativeProcessorDef[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY_DECLARATIVE);
  const list = data[STORAGE_KEY_DECLARATIVE];
  if (!Array.isArray(list)) return [];
  const result: DeclarativeProcessorDef[] = [];
  for (const item of list) {
    const v = validateDeclarativeProcessor(item);
    if (v.ok) result.push(v.value);
  }
  return result;
}

export async function saveDeclarativeProcessors(
  defs: DeclarativeProcessorDef[],
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_DECLARATIVE]: defs });
}

/** Validate, persist (upsert by id), and register into the live registry. */
export async function installDeclarativeProcessor(
  raw: unknown,
): Promise<{ ok: true; def: DeclarativeProcessorDef } | { ok: false; error: string }> {
  const v = validateDeclarativeProcessor(raw);
  if (!v.ok) return v;

  const existing = await loadDeclarativeFromStorage();
  const next = existing.filter((d) => d.id !== v.value.id);
  next.push(v.value);
  await saveDeclarativeProcessors(next);

  registerProcessor(toProcessor(v.value));
  return { ok: true, def: v.value };
}

export async function registerStoredDeclarativeProcessors(): Promise<void> {
  const defs = await loadDeclarativeFromStorage();
  for (const def of defs) {
    registerProcessor(toProcessor(def));
  }
}
