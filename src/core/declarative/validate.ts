import type {
  DeclarativeProcessorDef,
  MapAllSpec,
  MapTreeSpec,
  Op,
  OutputNode,
  Pipeline,
  VarDef,
} from "./types";
import { DECLARATIVE_SCHEMA_VERSION } from "./types";

export function validateDeclarativeProcessor(
  raw: unknown,
): { ok: true; value: DeclarativeProcessorDef } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Processor JSON must be an object" };
  }
  const o = raw as Record<string, unknown>;

  if (o.schemaVersion !== DECLARATIVE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion (expected ${DECLARATIVE_SCHEMA_VERSION})`,
    };
  }
  if (typeof o.id !== "string" || !o.id.trim()) {
    return { ok: false, error: "Missing id" };
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    return { ok: false, error: "Missing name" };
  }
  if (!Array.isArray(o.matches) || o.matches.length === 0 || !o.matches.every((m) => typeof m === "string")) {
    return { ok: false, error: "matches must be a non-empty string array" };
  }
  if (o.priority !== undefined && typeof o.priority !== "number") {
    return { ok: false, error: "priority must be a number" };
  }
  if (o.mimeType !== undefined && typeof o.mimeType !== "string") {
    return { ok: false, error: "mimeType must be a string" };
  }
  if (o.wait !== undefined) {
    if (!o.wait || typeof o.wait !== "object") {
      return { ok: false, error: "wait must be an object" };
    }
    const w = o.wait as Record<string, unknown>;
    if (typeof w.selector !== "string") {
      return { ok: false, error: "wait.selector must be a string" };
    }
    if (w.timeoutMs !== undefined && typeof w.timeoutMs !== "number") {
      return { ok: false, error: "wait.timeoutMs must be a number" };
    }
  }
  if (o.before !== undefined) {
    if (!Array.isArray(o.before)) {
      return { ok: false, error: "before must be an array" };
    }
    for (let i = 0; i < o.before.length; i++) {
      const a = o.before[i] as Record<string, unknown>;
      if (!a || typeof a !== "object") {
        return { ok: false, error: `before[${i}] must be an object` };
      }
      const hasClick = typeof a.clickText === "string";
      const hasScroll = typeof a.scrollIntoView === "string";
      if (!hasClick && !hasScroll) {
        return {
          ok: false,
          error: `before[${i}] requires clickText or scrollIntoView`,
        };
      }
      if (hasClick && hasScroll) {
        return {
          ok: false,
          error: `before[${i}] cannot mix clickText and scrollIntoView`,
        };
      }
    }
  }
  if (!o.vars || typeof o.vars !== "object" || Array.isArray(o.vars)) {
    return { ok: false, error: "vars must be an object" };
  }
  for (const [key, def] of Object.entries(o.vars as Record<string, unknown>)) {
    const v = validateVarDef(def);
    if (!v.ok) return { ok: false, error: `vars.${key}: ${v.error}` };
  }
  const out = validateOutputNode(o.output);
  if (!out.ok) return { ok: false, error: `output: ${out.error}` };

  return { ok: true, value: o as unknown as DeclarativeProcessorDef };
}

function validateVarDef(def: unknown): { ok: true } | { ok: false; error: string } {
  if (Array.isArray(def)) {
    return validatePipeline(def);
  }
  if (!def || typeof def !== "object") {
    return { ok: false, error: "must be a pipeline array or mapTree/mapAll object" };
  }
  const o = def as Record<string, unknown>;
  if (!Array.isArray(o.from)) {
    return { ok: false, error: "map var requires from pipeline" };
  }
  const fromOk = validatePipeline(o.from);
  if (!fromOk.ok) return fromOk;
  if (o.mapTree && typeof o.mapTree === "object") {
    return validateMapTree(o.mapTree as MapTreeSpec);
  }
  if (o.mapAll && typeof o.mapAll === "object") {
    return validateMapAll(o.mapAll as MapAllSpec);
  }
  return { ok: false, error: "mapTree or mapAll object required" };
}

function validateMapAll(mt: MapAllSpec): { ok: true } | { ok: false; error: string } {
  if (typeof mt.items !== "string" || !mt.items) {
    return { ok: false, error: "mapAll.items required" };
  }
  if (typeof mt.template !== "string") {
    return { ok: false, error: "mapAll.template required" };
  }
  if (!mt.fields || typeof mt.fields !== "object") {
    return { ok: false, error: "mapAll.fields required" };
  }
  for (const [k, p] of Object.entries(mt.fields)) {
    const r = validatePipeline(p);
    if (!r.ok) return { ok: false, error: `fields.${k}: ${r.error}` };
  }
  return { ok: true };
}

function validateMapTree(mt: MapTreeSpec): { ok: true } | { ok: false; error: string } {
  if (typeof mt.node !== "string" || !mt.node) {
    return { ok: false, error: "mapTree.node required" };
  }
  if (typeof mt.template !== "string") {
    return { ok: false, error: "mapTree.template required" };
  }
  if (!mt.fields || typeof mt.fields !== "object") {
    return { ok: false, error: "mapTree.fields required" };
  }
  for (const [k, p] of Object.entries(mt.fields)) {
    const r = validatePipeline(p);
    if (!r.ok) return { ok: false, error: `fields.${k}: ${r.error}` };
  }
  return { ok: true };
}

function validatePipeline(ops: unknown): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(ops)) return { ok: false, error: "pipeline must be an array" };
  for (let i = 0; i < ops.length; i++) {
    const r = validateOp(ops[i]);
    if (!r.ok) return { ok: false, error: `op[${i}]: ${r.error}` };
  }
  return { ok: true };
}

function validateOp(op: unknown): { ok: true } | { ok: false; error: string } {
  if (!op || typeof op !== "object" || Array.isArray(op)) {
    return { ok: false, error: "op must be an object" };
  }
  const o = op as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => k !== "group" && k !== "flags");
  // allow match+group, selectByText object
  if ("select" in o && typeof o.select === "string") return { ok: true };
  if ("selectAll" in o && typeof o.selectAll === "string") return { ok: true };
  if ("text" in o && o.text === true) return { ok: true };
  if ("html" in o && o.html === true) return { ok: true };
  if ("htmlToMarkdown" in o && o.htmlToMarkdown === true) return { ok: true };
  if ("attr" in o && typeof o.attr === "string") return { ok: true };
  if ("match" in o && typeof o.match === "string") return { ok: true };
  if ("closest" in o && typeof o.closest === "string") return { ok: true };
  if ("selectByText" in o && o.selectByText && typeof o.selectByText === "object") {
    const s = o.selectByText as Record<string, unknown>;
    if (typeof s.selector === "string" && typeof s.pattern === "string") return { ok: true };
    return { ok: false, error: "selectByText needs selector and pattern" };
  }
  if ("excludeWithin" in o) return validatePipeline(o.excludeWithin);
  if ("childContaining" in o && typeof o.childContaining === "string") return { ok: true };
  if ("first" in o && o.first === true) return { ok: true };
  if ("previousSibling" in o && o.previousSibling === true) return { ok: true };
  if ("parent" in o && o.parent === true) return { ok: true };
  if ("required" in o && typeof o.required === "string") return { ok: true };
  if ("const" in o && typeof o.const === "string") return { ok: true };
  if ("textsJoin" in o && typeof o.textsJoin === "string") return { ok: true };
  if ("isInside" in o && typeof o.isInside === "string") return { ok: true };
  if ("fallback" in o) {
    if (!Array.isArray(o.fallback)) return { ok: false, error: "fallback must be array of pipelines" };
    for (const p of o.fallback) {
      const r = validatePipeline(p);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  void keys;
  return { ok: false, error: "unknown op" };
}

function validateOutputNode(node: unknown): { ok: true } | { ok: false; error: string } {
  if (!node || typeof node !== "object") return { ok: false, error: "must be an object" };
  const o = node as Record<string, unknown>;
  if ("template" in o && typeof o.template === "string") return { ok: true };
  if ("var" in o && typeof o.var === "string") return { ok: true };
  if ("join" in o) {
    if (!Array.isArray(o.join) || o.join.length !== 2) {
      return { ok: false, error: "join must be [separator, nodes[]]" };
    }
    const [sep, nodes] = o.join as [unknown, unknown];
    if (typeof sep !== "string") return { ok: false, error: "join separator must be string" };
    if (!Array.isArray(nodes)) return { ok: false, error: "join nodes must be array" };
    for (const n of nodes) {
      const r = validateOutputNode(n);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  return { ok: false, error: "output node needs template, var, or join" };
}

export type { Pipeline, Op, VarDef, OutputNode };
