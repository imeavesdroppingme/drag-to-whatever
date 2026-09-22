import type { Artifact, PrepareStatus, Processor } from "./types";
import { createPageApi } from "./page-api";
import { getProcessor, autoSelectProcessor } from "./registry";

export type PrepareController = {
  prepare: (processorId: string) => Promise<void>;
  getStatus: () => PrepareStatus;
  getArtifact: () => Artifact | null;
  invalidate: () => void;
  onStatus: (cb: (status: PrepareStatus) => void) => void;
};

export function createPrepareController(): PrepareController {
  let status: PrepareStatus = { kind: "idle" };
  let generation = 0;
  let listener: ((status: PrepareStatus) => void) | null = null;

  function setStatus(next: PrepareStatus): void {
    status = next;
    listener?.(next);
  }

  return {
    getStatus: () => status,
    getArtifact: () => (status.kind === "ready" ? status.artifact : null),
    invalidate() {
      generation += 1;
      setStatus({ kind: "idle" });
    },
    onStatus(cb) {
      listener = cb;
    },
    async prepare(processorId: string) {
      const gen = ++generation;
      const processor: Processor | undefined =
        getProcessor(processorId) ?? autoSelectProcessor(location.href);

      setStatus({ kind: "preparing" });
      try {
        const page = createPageApi(document);
        const artifact = await processor.process(page);
        if (gen !== generation) return;
        if (!artifact.content?.trim()) {
          setStatus({ kind: "error", message: "Processor returned empty content" });
          return;
        }
        setStatus({ kind: "ready", artifact });
      } catch (err) {
        if (gen !== generation) return;
        const message =
          err instanceof Error ? err.message : "Processor failed";
        setStatus({ kind: "error", message });
      }
    },
  };
}
