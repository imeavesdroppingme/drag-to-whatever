# Privacy Policy — DragToWhatever

**Last updated:** 22 September 2026  
**Publisher:** imeavesdropping \<imeavesdropping.me@gmail.com\>  
**Extension:** DragToWhatever (Chrome, Manifest V3)

## Summary

DragToWhatever runs **locally in your browser**. It does not operate a backend for this extension, does not sell data, and does not include analytics or advertising SDKs.

## What the extension does

When you turn a session **ON**, DragToWhatever injects a small overlay on the current page so you can:

- choose a **processor** (built-in or one you load),
- transform the visible page into text,
- **drag** or **copy** that text into other apps.

When the session is **OFF**, overlays are removed and the content script is not kept active for further use. Closing Chrome clears the session; the extension starts **OFF**.

## Data the extension processes

- **Page content** on sites you visit while a session is ON, only to build the text artifact you drag or copy. That content is processed on your device.
- **Processor definitions** you import via **Load JSON**, stored in Chrome local storage on your profile so they can be re-registered in later sessions.
- **Session state** (ON/OFF) in Chrome session storage.

The extension does **not** upload page content, processor JSON, or clipboard contents to imeavesdropping servers as part of normal operation.

## Permissions (why they are requested)

| Permission | Purpose |
|------------|---------|
| `storage` | Remember session ON/OFF and JSON processors you load |
| `scripting` | Inject/remove the overlay content script while a session is ON |
| `tabs` | Apply inject/teardown across open tabs for the current session |
| `clipboardWrite` | Optional **Copy** of the prepared artifact |
| Host access (`http(s)://*/*`) | Run on the page you are viewing during an active session |

## Third parties

- Publishing and updates go through the **Chrome Web Store** (Google). Their terms and privacy policy apply to store distribution and install telemetry that Google may collect independently of this extension.
- Optional site-specific processors (including example JSON in the public repository) only read the DOM of pages you open; they do not add network calls unless a future processor you load explicitly does so (built-in/example processors are DOM-only).

## Children

The extension is not directed at children and is not intended for use by anyone under 13.

## Changes

We may update this policy when the extension’s behavior or permissions change. The “Last updated” date at the top will be revised, and the current version will remain at this URL in the public repository.

## Contact

Questions about privacy: **imeavesdropping.me@gmail.com**  
Project site: [https://imeavesdropping.com](https://imeavesdropping.com)  
Source: [https://github.com/imeavesdroppingme/drag-to-whatever](https://github.com/imeavesdroppingme/drag-to-whatever)
