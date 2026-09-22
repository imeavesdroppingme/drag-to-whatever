import type { Artifact, PrepareStatus, Processor } from "../core/types";
import {
  autoSelectProcessor,
  getProcessor,
  listProcessors,
  matchingProcessors,
} from "../core/registry";
import { normalizePageUrl } from "../core/match";
import overlayCss from "./overlay.css?inline";

const LOGO_SVG = `<svg class="dtw-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="#1F1F22"/>
  <rect x="1.75" y="1.75" width="28.5" height="28.5" rx="7.25" stroke="#D67A2A" stroke-width="1.5"/>
  <g transform="translate(17.2 3.2) rotate(18)">
    <rect x="0" y="0" width="9.2" height="11.5" rx="1.1" fill="#F7F3EC"/>
    <path d="M5.6 0V3.2H9.2" fill="#E8DFD2"/>
    <path d="M2.1 5.2h5M2.1 7.4h5M2.1 9.6h3.4" stroke="#D67A2A" stroke-width="0.9" stroke-linecap="round"/>
  </g>
  <path d="M14.2 9.5l1.6-1.7M12.6 11.4l1.4-1.5" stroke="#D67A2A" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/>
  <path d="M7.2 26.2c0-1.4.9-2.4 2.2-2.4h1.1c.4-1.3 1.5-2.1 2.8-2.1 1.1 0 2 .5 2.5 1.3.4-.7 1.2-1.2 2.1-1.2 1.4 0 2.4 1.1 2.4 2.5v.4c.7-.2 1.5.2 1.8 1 .4 1-.2 2.1-1.3 2.4l-8.4 2.2c-1.5.4-3-.5-3.4-2l-.8-2.1z" fill="#F2C29A"/>
  <path d="M9.4 21.8c.2-.9.9-1.5 1.8-1.5.7 0 1.3.4 1.6 1" stroke="#C48A55" stroke-width="0.7" stroke-linecap="round"/>
  <path d="M13.6 20.8c.15-.55.65-.95 1.25-.95.7 0 1.25.5 1.35 1.15" stroke="#C48A55" stroke-width="0.7" stroke-linecap="round"/>
  <path d="M17.2 21.2c.2-.45.6-.75 1.1-.75.7 0 1.2.55 1.2 1.2" stroke="#C48A55" stroke-width="0.7" stroke-linecap="round"/>
  <path d="M7.6 23.4c-.9.2-1.5 1-1.5 1.9 0 .8.5 1.5 1.3 1.7" fill="#E8B489"/>
  <circle cx="11.6" cy="25.4" r="0.55" fill="#C48A55" opacity="0.7"/>
</svg>`;

const GRIP_SVG = `<svg class="dtw-drag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <circle cx="5.5" cy="3.5" r="1.35" fill="#D67A2A"/>
  <circle cx="10.5" cy="3.5" r="1.35" fill="#D67A2A"/>
  <circle cx="5.5" cy="8" r="1.35" fill="#D67A2A"/>
  <circle cx="10.5" cy="8" r="1.35" fill="#D67A2A"/>
  <circle cx="5.5" cy="12.5" r="1.35" fill="#D67A2A"/>
  <circle cx="10.5" cy="12.5" r="1.35" fill="#D67A2A"/>
</svg>`;

const COPY_SVG = `<svg class="dtw-drag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="5.5" y="3.5" width="8" height="10" rx="1.2" stroke="#D67A2A" stroke-width="1.4"/>
  <path d="M3.5 5.5h-.3A1.2 1.2 0 0 0 2 6.7v6.6A1.2 1.2 0 0 0 3.2 14.5h6.6a1.2 1.2 0 0 0 1.2-1.2V13" stroke="#D67A2A" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

export type OverlayController = {
  destroy: () => void;
  setStatus: (status: PrepareStatus) => void;
  getSelectedProcessorId: () => string;
  setSelectedProcessorId: (id: string) => void;
  onProcessorChange: (cb: (id: string, manual: boolean) => void) => void;
  onLoadJson: (cb: (raw: unknown) => Promise<{ ok: true } | { ok: false; error: string }>) => void;
  getCachedArtifact: () => Artifact | null;
  refreshProcessorOptions: (url: string) => void;
  showMessage: (message: string, kind?: "error" | "info") => void;
};

export function mountOverlay(host: HTMLElement): OverlayController {
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = overlayCss;

  const root = document.createElement("div");
  root.className = "dtw-root";
  root.innerHTML = `
    <div class="dtw-header" data-role="move">
      ${LOGO_SVG}
      <span class="dtw-brand">DragToWhatever</span>
      <span class="dtw-status" data-role="status" hidden></span>
    </div>
    <div class="dtw-body">
      <select class="dtw-select" data-role="processor" aria-label="Processor"></select>
      <p class="dtw-error" data-role="error" hidden></p>
      <div class="dtw-actions">
        <div class="dtw-drag" data-role="drag" draggable="false" aria-disabled="true">
          ${GRIP_SVG}
          <span data-role="drag-label">Drag</span>
        </div>
        <button type="button" class="dtw-copy" data-role="copy" disabled>
          ${COPY_SVG}
          <span data-role="copy-label">Copy</span>
        </button>
      </div>
      <button type="button" class="dtw-load" data-role="load">Load JSON</button>
      <input type="file" accept="application/json,.json" data-role="file" hidden />
    </div>
  `;

  shadow.append(style, root);

  const statusEl = root.querySelector<HTMLElement>("[data-role='status']")!;
  const selectEl = root.querySelector<HTMLSelectElement>("[data-role='processor']")!;
  const errorEl = root.querySelector<HTMLElement>("[data-role='error']")!;
  const dragEl = root.querySelector<HTMLElement>("[data-role='drag']")!;
  const dragLabel = root.querySelector<HTMLElement>("[data-role='drag-label']")!;
  const copyBtn = root.querySelector<HTMLButtonElement>("[data-role='copy']")!;
  const copyLabel = root.querySelector<HTMLElement>("[data-role='copy-label']")!;
  const loadBtn = root.querySelector<HTMLButtonElement>("[data-role='load']")!;
  const fileInput = root.querySelector<HTMLInputElement>("[data-role='file']")!;
  const moveEl = root.querySelector<HTMLElement>("[data-role='move']")!;

  let selectedId = "";
  let cached: Artifact | null = null;
  let changeHandler: ((id: string, manual: boolean) => void) | null = null;
  let loadHandler:
    | ((raw: unknown) => Promise<{ ok: true } | { ok: false; error: string }>)
    | null = null;
  let destroyed = false;
  let copyResetTimer = 0;

  function fillOptions(url: string, preferredId?: string): void {
    selectEl.innerHTML = "";

    const suggested = matchingProcessors(url);
    const suggestedList =
      suggested.length > 0 ? suggested : [autoSelectProcessor(url)];
    const suggestedIds = new Set(suggestedList.map((p) => p.id));
    const rest = listProcessors().filter((p) => !suggestedIds.has(p.id));

    const addGroup = (label: string, items: Processor[]) => {
      if (items.length === 0) return;
      const group = document.createElement("optgroup");
      group.label = label;
      for (const p of items) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        group.append(opt);
      }
      selectEl.append(group);
    };

    addGroup("Suggested", suggestedList);
    addGroup("All", rest);

    const pick =
      (preferredId && getProcessor(preferredId)?.id) ||
      suggestedList[0]?.id ||
      autoSelectProcessor(url).id;
    selectedId = pick;
    selectEl.value = pick;
  }

  function setActionsEnabled(enabled: boolean): void {
    dragEl.setAttribute("draggable", enabled ? "true" : "false");
    dragEl.setAttribute("aria-disabled", enabled ? "false" : "true");
    dragLabel.textContent = "Drag";
    copyBtn.disabled = !enabled;
    if (!enabled) {
      copyLabel.textContent = "Copy";
      if (copyResetTimer) {
        window.clearTimeout(copyResetTimer);
        copyResetTimer = 0;
      }
    }
  }

  function setStatus(status: PrepareStatus): void {
    if (destroyed) return;
    statusEl.dataset.kind = status.kind;
    errorEl.hidden = true;
    errorEl.textContent = "";

    switch (status.kind) {
      case "idle":
        statusEl.hidden = true;
        statusEl.textContent = "";
        cached = null;
        setActionsEnabled(false);
        break;
      case "preparing":
        statusEl.hidden = false;
        statusEl.textContent = "…";
        cached = null;
        setActionsEnabled(false);
        break;
      case "ready":
        statusEl.hidden = true;
        statusEl.textContent = "";
        cached = status.artifact;
        setActionsEnabled(true);
        break;
      case "error":
        statusEl.hidden = true;
        statusEl.textContent = "";
        cached = null;
        errorEl.hidden = false;
        errorEl.textContent = status.message;
        setActionsEnabled(false);
        break;
    }
  }

  async function copyCached(): Promise<void> {
    if (!cached?.content || copyBtn.disabled) return;
    try {
      await navigator.clipboard.writeText(cached.content);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = cached.content;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.documentElement.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        ta.remove();
      }
    }
    copyLabel.textContent = "Copied";
    if (copyResetTimer) window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
      if (!destroyed && !copyBtn.disabled) copyLabel.textContent = "Copy";
      copyResetTimer = 0;
    }, 1200);
  }

  copyBtn.addEventListener("click", () => {
    void copyCached();
  });

  loadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file || !loadHandler) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const text = String(reader.result ?? "");
          const raw = JSON.parse(text) as unknown;
          const result = await loadHandler!(raw);
          if (!result.ok) {
            errorEl.hidden = false;
            errorEl.textContent = result.error;
            return;
          }
          errorEl.hidden = true;
          errorEl.textContent = "";
        } catch {
          errorEl.hidden = false;
          errorEl.textContent = "Invalid JSON file";
        }
      })();
    };
    reader.readAsText(file);
  });

  dragEl.addEventListener("dragstart", (event) => {
    if (!cached?.content) {
      event.preventDefault();
      return;
    }
    const dt = event.dataTransfer;
    if (!dt) {
      event.preventDefault();
      return;
    }
    dt.setData("text/plain", cached.content);
    dt.effectAllowed = "copyMove";
  });

  selectEl.addEventListener("change", () => {
    selectedId = selectEl.value;
    changeHandler?.(selectedId, true);
  });

  let draggingPanel = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  moveEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    draggingPanel = true;
    moveEl.setPointerCapture(event.pointerId);
    const rect = root.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.style.left = `${originLeft}px`;
    root.style.top = `${originTop}px`;
  });

  moveEl.addEventListener("pointermove", (event) => {
    if (!draggingPanel) return;
    root.style.left = `${originLeft + (event.clientX - startX)}px`;
    root.style.top = `${originTop + (event.clientY - startY)}px`;
  });

  const endMove = (event: PointerEvent) => {
    if (!draggingPanel) return;
    draggingPanel = false;
    try {
      moveEl.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };
  moveEl.addEventListener("pointerup", endMove);
  moveEl.addEventListener("pointercancel", endMove);

  fillOptions(normalizePageUrl(location.href));

  return {
    destroy() {
      destroyed = true;
      host.remove();
    },
    setStatus,
    getSelectedProcessorId: () => selectedId,
    setSelectedProcessorId(id) {
      if (!getProcessor(id)) return;
      selectedId = id;
      selectEl.value = id;
    },
    onProcessorChange(cb) {
      changeHandler = cb;
    },
    onLoadJson(cb) {
      loadHandler = cb;
    },
    getCachedArtifact: () => cached,
    refreshProcessorOptions(url) {
      fillOptions(url, selectedId);
    },
    showMessage(message, kind = "error") {
      if (kind === "info") {
        statusEl.hidden = false;
        statusEl.dataset.kind = "preparing";
        statusEl.textContent = message;
        return;
      }
      errorEl.hidden = false;
      errorEl.textContent = message;
    },
  };
}
