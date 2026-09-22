/**
 * Wait briefly for a selector to appear. Narrow, short-lived observer.
 * Disconnects immediately on success or timeout.
 */
export function waitForSelector(
  root: ParentNode,
  selector: string,
  timeoutMs: number,
): Promise<Element | null> {
  const existing = root.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (el: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(el);
    };

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) finish(el);
    });

    observer.observe(root instanceof Document ? root.documentElement : root, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
