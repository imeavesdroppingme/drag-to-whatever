import { OVERLAY_HOST_ID, MSG, type ExtensionMessage } from "../shared/messaging";
import { registerBuiltInProcessors } from "../processors";
import { autoSelectProcessor, getProcessor } from "../core/registry";
import { normalizePageUrl } from "../core/match";
import { createPrepareController } from "../core/prepare";
import { mountOverlay, type OverlayController } from "./overlay";

type Runtime = {
  remount: () => void;
  teardown: () => void;
};

declare global {
  interface Window {
    __dragtowhatever?: Runtime;
  }
}

if (window.__dragtowhatever) {
  window.__dragtowhatever.remount();
} else {
  window.__dragtowhatever = createRuntime();
  window.__dragtowhatever.remount();
}

function createRuntime(): Runtime {
  registerBuiltInProcessors();

  let overlay: OverlayController | null = null;
  let host: HTMLElement | null = null;
  const prepare = createPrepareController();

  /** Page-scoped manual override: cleared when normalized URL changes. */
  let pageKey = normalizePageUrl(location.href);
  let manualOverrideId: string | null = null;
  let urlWatchCleanup: (() => void) | null = null;
  let active = false;

  function ensureOverlay(): OverlayController {
    if (overlay && host?.isConnected) return overlay;

    document.getElementById(OVERLAY_HOST_ID)?.remove();

    host = document.createElement("div");
    host.id = OVERLAY_HOST_ID;
    host.setAttribute("data-dragtowhatever", "1");
    document.documentElement.appendChild(host);

    overlay = mountOverlay(host);
    prepare.onStatus((status) => overlay?.setStatus(status));

    overlay.onProcessorChange((id, manual) => {
      if (manual) {
        manualOverrideId = id;
      }
      void prepare.prepare(id);
    });

    return overlay;
  }

  function resolveProcessorId(): string {
    if (manualOverrideId && getProcessor(manualOverrideId)) {
      return manualOverrideId;
    }
    return autoSelectProcessor(location.href).id;
  }

  function refreshForCurrentPage(): void {
    const ui = ensureOverlay();
    const url = normalizePageUrl(location.href);
    ui.refreshProcessorOptions(url);
    const id = resolveProcessorId();
    ui.setSelectedProcessorId(id);
    void prepare.prepare(id);
  }

  function onUrlPossiblyChanged(): void {
    if (!active) return;
    const next = normalizePageUrl(location.href);
    if (next === pageKey) return;
    pageKey = next;
    manualOverrideId = null;
    prepare.invalidate();
    refreshForCurrentPage();
  }

  function startUrlWatch(): void {
    if (urlWatchCleanup) return;

    const onPop = () => onUrlPossiblyChanged();
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args) {
      origPush(...args);
      onUrlPossiblyChanged();
    };
    history.replaceState = function (...args) {
      origReplace(...args);
      onUrlPossiblyChanged();
    };

    const interval = window.setInterval(() => onUrlPossiblyChanged(), 1500);

    urlWatchCleanup = () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
      history.pushState = origPush;
      history.replaceState = origReplace;
      clearInterval(interval);
      urlWatchCleanup = null;
    };
  }

  function stopUrlWatch(): void {
    urlWatchCleanup?.();
  }

  function teardown(): void {
    active = false;
    stopUrlWatch();
    prepare.invalidate();
    overlay?.destroy();
    overlay = null;
    host = null;
    manualOverrideId = null;
  }

  function remount(): void {
    if (active && host?.isConnected) return;
    active = true;
    pageKey = normalizePageUrl(location.href);
    refreshForCurrentPage();
    startUrlWatch();
  }

  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message?.type === MSG.TEARDOWN) {
      teardown();
    }
  });

  return { remount, teardown };
}
