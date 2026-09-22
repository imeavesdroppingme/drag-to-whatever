import {
  CONTENT_SCRIPT_ID,
  MSG,
  SESSION_KEY,
  type ExtensionMessage,
} from "../shared/messaging";

const CONTENT_MATCHES = ["http://*/*", "https://*/*"] as const;

async function getSessionActive(): Promise<boolean> {
  const data = await chrome.storage.session.get(SESSION_KEY);
  return Boolean(data[SESSION_KEY]);
}

async function setSessionActive(active: boolean): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: active });
}

async function updateActionUi(active: boolean): Promise<void> {
  await chrome.action.setBadgeText({ text: active ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({
    color: active ? "#D67A2A" : "#666666",
  });
  await chrome.action.setTitle({
    title: active ? "DragToWhatever (ON)" : "DragToWhatever (OFF)",
  });
}

async function registerContentScript(): Promise<void> {
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });
  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches: [...CONTENT_MATCHES],
        js: ["content.js"],
        runAt: "document_idle",
        persistAcrossSessions: false,
      },
    ]);
    return;
  }
  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: [...CONTENT_MATCHES],
      js: ["content.js"],
      runAt: "document_idle",
      persistAcrossSessions: false,
    },
  ]);
}

async function unregisterContentScript(): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [CONTENT_SCRIPT_ID],
    });
  } catch {
    // Not registered
  }
}

function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

async function injectIntoTab(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (err) {
    console.debug("DragToWhatever: inject skipped", tabId, err);
  }
}

async function injectIntoOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((t) => t.id != null && isInjectableUrl(t.url))
      .map((t) => injectIntoTab(t.id!)),
  );
}

async function teardownAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const message: ExtensionMessage = { type: MSG.TEARDOWN };
  await Promise.all(
    tabs
      .filter((t) => t.id != null && isInjectableUrl(t.url))
      .map(async (t) => {
        try {
          await chrome.tabs.sendMessage(t.id!, message);
        } catch {
          // No content script
        }
      }),
  );
}

async function turnOn(): Promise<void> {
  await setSessionActive(true);
  await updateActionUi(true);
  await registerContentScript();
  await injectIntoOpenTabs();
}

async function turnOff(): Promise<void> {
  await setSessionActive(false);
  await updateActionUi(false);
  await unregisterContentScript();
  await teardownAllTabs();
}

chrome.runtime.onInstalled.addListener(async () => {
  const active = await getSessionActive();
  await updateActionUi(active);
  if (!active) {
    await unregisterContentScript();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  // session storage is empty after browser restart → OFF
  await updateActionUi(false);
  await unregisterContentScript();
});

chrome.action.onClicked.addListener(async () => {
  const active = await getSessionActive();
  if (active) {
    await turnOff();
  } else {
    await turnOn();
  }
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message?.type === MSG.PING) {
    void getSessionActive().then((active) => {
      sendResponse({ active });
    });
    return true;
  }
  return false;
});
