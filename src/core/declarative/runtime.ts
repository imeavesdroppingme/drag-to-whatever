import type {
  BeforeAction,
  DeclarativeProcessorDef,
  DeclarativeRunResult,
  MapAllSpec,
  MapTreeSpec,
  Op,
  OutputNode,
  Pipeline,
  VarDef,
} from "./types";
import { waitForSelector } from "../wait-for";
import type { PageApi } from "../page-api";

type Ctx = Element | Element[] | string | null;

class DeclError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeclError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBeforeActions(
  actions: BeforeAction[],
  doc: Document,
): Promise<void> {
  for (const action of actions) {
    if ("scrollIntoView" in action) {
      const el = doc.querySelector(action.scrollIntoView) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        await sleep(action.delayMs ?? 600);
      }
      if (action.thenWait) {
        await waitForSelector(doc, action.thenWait, action.timeoutMs ?? 10000);
      }
      continue;
    }

    const re = new RegExp(action.clickText, action.flags ?? "i");
    const max = action.max ?? 15;
    const delay = action.delayMs ?? 400;
    const clicked = new Set<Element>();
    for (let n = 0; n < max; n++) {
      const candidates = Array.from(
        doc.querySelectorAll("button, a, [role='button'], div[role='button'], span[role='button']"),
      );
      const el = candidates.find((node) => {
        if (clicked.has(node)) return false;
        const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text.length >= 120) return false;
        // Avoid expand/collapse toggle loops (Hide replies, etc.)
        if (/\b(hide|collapse|nascondi|chiudi)\b/i.test(text)) return false;
        return re.test(text);
      }) as HTMLElement | undefined;
      if (!el) break;
      clicked.add(el);
      el.click();
      await sleep(delay);
    }
  }
}

export async function runDeclarativeProcessor(
  def: DeclarativeProcessorDef,
  page: PageApi,
): Promise<DeclarativeRunResult> {
  if (def.wait?.selector) {
    const found = await waitForSelector(
      page.document,
      def.wait.selector,
      def.wait.timeoutMs ?? 8000,
    );
    if (!found) {
      throw new DeclError(`Could not find expected content (${def.wait.selector})`);
    }
  }

  if (def.before?.length) {
    await runBeforeActions(def.before, page.document);
  }

  const builtins: Record<string, string> = {
    $url: page.url,
    $title: page.title,
  };

  const vars: Record<string, string> = { ...builtins };

  for (const [name, varDef] of Object.entries(def.vars)) {
    vars[name] = await resolveVar(varDef, page, page.document);
  }

  const content = renderOutput(def.output, vars).trim();
  if (!content) {
    throw new DeclError("Processor produced empty content");
  }

  return {
    content,
    mimeType: def.mimeType ?? "text/plain",
  };
}

async function resolveVar(
  def: VarDef,
  page: PageApi,
  root: ParentNode,
): Promise<string> {
  if (Array.isArray(def)) {
    const result = runPipeline(def, page, root as unknown as Ctx);
    return valueToString(result, page);
  }

  const container = runPipeline(def.from, page, root as unknown as Ctx);
  const el = asElement(container) ?? (asParent(container) as Element | null);
  if (!el && !asParent(container)) return "";

  const scope: ParentNode =
    (asParent(container) as ParentNode | null) ?? page.document;

  if ("mapAll" in def) {
    return runMapAll(def.mapAll, page, scope);
  }
  if ("mapTree" in def) {
    const treeRoot = asElement(container);
    if (!treeRoot) return "";
    return runMapTree(def.mapTree, page, treeRoot);
  }
  return "";
}

function runMapAll(spec: MapAllSpec, page: PageApi, scope: ParentNode): string {
  const nodes = Array.from(scope.querySelectorAll(spec.items));
  const lines: string[] = [];
  for (const node of nodes) {
    const fields: Record<string, string> = {};
    for (const [name, pipeline] of Object.entries(spec.fields)) {
      fields[name] = valueToString(runPipeline(pipeline, page, node), page);
    }
    const depth = Number.parseInt(fields.depth ?? "0", 10);
    const rendered = renderMapTemplate(
      spec.template,
      fields,
      Number.isFinite(depth) ? depth : 0,
    );
    if (rendered.trim()) lines.push(rendered);
  }
  return lines.join("\n\n").trim();
}

function runPipeline(ops: Pipeline, page: PageApi, initial: Ctx): Ctx {
  let ctx: Ctx = initial;
  for (const op of ops) {
    ctx = applyOp(op, page, ctx, initial);
  }
  return ctx;
}

function applyOp(op: Op, page: PageApi, ctx: Ctx, docRoot: Ctx): Ctx {
  if ("const" in op) {
    if (op.const === "$url") return page.url;
    if (op.const === "$title") return page.title;
    return op.const;
  }

  if ("fallback" in op) {
    for (const branch of op.fallback) {
      try {
        const result = runPipeline(branch, page, ctx);
        if (result == null || result === "") continue;
        if (typeof result === "string") {
          if (result.trim()) return result;
          continue;
        }
        if (Array.isArray(result)) {
          if (result.length > 0) return result;
          continue;
        }
        // Preserve Element / ParentNode for later select/mapAll/mapTree
        return result;
      } catch {
        // try next branch
      }
    }
    return null;
  }

  if ("required" in op) {
    const empty =
      ctx == null ||
      ctx === "" ||
      (Array.isArray(ctx) && ctx.length === 0);
    if (empty) throw new DeclError(op.required);
    return ctx;
  }

  if ("select" in op) {
    const scope = asParent(ctx) ?? page.document;
    return scope.querySelector(op.select);
  }

  if ("selectAll" in op) {
    const scope = asParent(ctx) ?? page.document;
    return Array.from(scope.querySelectorAll(op.selectAll));
  }

  if ("selectByText" in op) {
    const scope = asParent(ctx) ?? page.document;
    const flags = op.selectByText.flags ?? "i";
    const re = new RegExp(op.selectByText.pattern, flags);
    const nodes = Array.from(scope.querySelectorAll(op.selectByText.selector));
    return nodes.find((n) => re.test(n.textContent ?? "")) ?? null;
  }

  if ("closest" in op) {
    const el = asElement(ctx);
    return el?.closest(op.closest) ?? null;
  }

  if ("isInside" in op) {
    const el = asElement(ctx);
    return el?.closest(op.isInside) ? "1" : "0";
  }

  if ("previousSibling" in op) {
    const el = asElement(ctx);
    return (el?.previousElementSibling as Element | null) ?? null;
  }

  if ("parent" in op) {
    const el = asElement(ctx);
    return el?.parentElement ?? null;
  }

  if ("first" in op) {
    if (Array.isArray(ctx)) return ctx[0] ?? null;
    return ctx;
  }

  if ("excludeWithin" in op) {
    if (!Array.isArray(ctx)) return ctx;
    const regionCtx = runPipeline(op.excludeWithin, page, docRoot);
    const region = asElement(regionCtx);
    if (!region) return ctx;
    return ctx.filter((el) => !region.contains(el) || region === el);
  }

  if ("childContaining" in op) {
    const el = asElement(ctx);
    if (!el) return null;
    return (
      (Array.from(el.children).find(
        (c) =>
          c.matches(op.childContaining) ||
          Boolean(c.querySelector(op.childContaining)),
      ) as Element | undefined) ?? null
    );
  }

  if ("text" in op) {
    const el = asElement(ctx);
    if (!el) return "";
    return page.cleanText(el.textContent ?? "");
  }

  if ("html" in op) {
    const el = asElement(ctx);
    return el ? el.innerHTML : "";
  }

  if ("htmlToMarkdown" in op) {
    if (typeof ctx === "string") return page.toMarkdown(ctx);
    const el = asElement(ctx);
    return el ? page.toMarkdown(el.innerHTML) : "";
  }

  if ("attr" in op) {
    const el = asElement(ctx);
    return el?.getAttribute(op.attr) ?? "";
  }

  if ("match" in op) {
    const str = typeof ctx === "string" ? ctx : valueToString(ctx, page);
    const re = new RegExp(op.match);
    const m = str.match(re);
    if (!m) return "";
    const group = op.group ?? 0;
    return m[group] ?? "";
  }

  if ("textsJoin" in op) {
    if (Array.isArray(ctx)) {
      return ctx
        .map((el) => page.cleanText(el.textContent ?? ""))
        .filter(Boolean)
        .join(op.textsJoin);
    }
    const el = asElement(ctx);
    if (!el) return "";
    return Array.from(el.querySelectorAll("p"))
      .map((p) => page.cleanText(p.textContent ?? ""))
      .filter(Boolean)
      .join(op.textsJoin);
  }

  return ctx;
}

function runMapTree(spec: MapTreeSpec, page: PageApi, container: Element): string {
  const lines: string[] = [];
  walkMapTree(spec, page, container, 0, lines);
  return lines.join("\n\n").trim();
}

function walkMapTree(
  spec: MapTreeSpec,
  page: PageApi,
  container: Element,
  depth: number,
  out: string[],
): void {
  for (const child of Array.from(container.children)) {
    const commentEl = child.matches(spec.node)
      ? child
      : (Array.from(child.children).find((c) => c.matches(spec.node)) as
          | Element
          | undefined);

    if (commentEl) {
      const fields: Record<string, string> = {};
      for (const [name, pipeline] of Object.entries(spec.fields)) {
        fields[name] = valueToString(runPipeline(pipeline, page, commentEl), page);
      }
      const rendered = renderMapTemplate(spec.template, fields, depth);
      if (rendered.trim()) out.push(rendered);

      if (spec.children?.fromItemChildren) {
        for (const nested of Array.from(child.children)) {
          if (nested === commentEl) continue;
          if (nested.matches(spec.node) || nested.querySelector(spec.node)) {
            walkMapTree(
              spec,
              page,
              nested.matches(spec.node) ? (nested.parentElement as Element) : nested,
              depth + 1,
              out,
            );
          }
        }
      }
      continue;
    }

    if (child.querySelector(spec.node)) {
      walkMapTree(spec, page, child, depth, out);
    }
  }
}

function renderMapTemplate(
  template: string,
  fields: Record<string, string>,
  depth: number,
): string {
  const indentPrefix = "  ".repeat(depth);
  let result = template.replace(
    /\{\{\s*indentBy\s+(\w+)\s+(\w+)\s*\}\}/g,
    (_m, depthKey: string, fieldKey: string) => {
      const d = Number.parseInt(fields[depthKey] ?? "0", 10);
      const levels = Number.isFinite(d) && d > 0 ? d : 0;
      const prefix = "  ".repeat(levels);
      const val = fields[fieldKey] ?? "";
      return val
        .split("\n")
        .map((line) => `${prefix}  ${line}`)
        .join("\n");
    },
  );
  result = result.replace(/\{\{\s*indent\s+(\w+)\s*\}\}/g, (_m, key: string) => {
    const val = fields[key] ?? "";
    return val
      .split("\n")
      .map((line) => `${indentPrefix}  ${line}`)
      .join("\n");
  });
  result = result.replace(/\{\{\s*(\$?\w+)\s*\}\}/g, (_m, key: string) => fields[key] ?? "");
  // Prefix bullet with depth spaces when using plain indent depth
  if (depth > 0 && !template.includes("indentBy")) {
    result = result
      .split("\n")
      .map((line, i) => (i === 0 ? `${indentPrefix}${line}` : line))
      .join("\n");
  }
  // indentBy templates: prefix the first line (bullet) by depth field
  if (template.includes("indentBy")) {
    const d = Number.parseInt(fields.depth ?? String(depth), 10);
    const levels = Number.isFinite(d) && d > 0 ? d : 0;
    if (levels > 0) {
      const prefix = "  ".repeat(levels);
      result = result
        .split("\n")
        .map((line, i) => (i === 0 ? `${prefix}${line}` : line))
        .join("\n");
    }
  }
  return result;
}

function renderOutput(node: OutputNode, vars: Record<string, string>): string {
  if ("if" in node && node.if) {
    const v = vars[node.if];
    if (!v) return "";
  }

  if ("template" in node) {
    return interpolate(node.template, vars);
  }
  if ("var" in node) {
    return vars[node.var] ?? "";
  }
  if ("join" in node) {
    const [sep, parts] = node.join;
    return parts
      .map((p) => renderOutput(p, vars))
      .filter((s) => s.length > 0)
      .join(sep);
  }
  return "";
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\$?\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}

function asElement(ctx: Ctx): Element | null {
  if (!ctx) return null;
  if (typeof ctx === "string") return null;
  if (Array.isArray(ctx)) return ctx[0] ?? null;
  return ctx;
}

function asParent(ctx: Ctx): ParentNode | null {
  if (!ctx || typeof ctx === "string") return null;
  if (Array.isArray(ctx)) return ctx[0] ?? null;
  return ctx;
}

function valueToString(ctx: Ctx, page: PageApi): string {
  if (ctx == null) return "";
  if (typeof ctx === "string") return page.cleanText(ctx);
  if (Array.isArray(ctx)) {
    return ctx.map((el) => page.cleanText(el.textContent ?? "")).filter(Boolean).join("\n");
  }
  return page.cleanText(ctx.textContent ?? "");
}
