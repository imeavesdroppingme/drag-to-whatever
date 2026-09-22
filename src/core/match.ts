/**
 * Convert simple globs to RegExp.
 * Supports "*" anywhere; patterns without scheme match any http(s) host path.
 */
export function patternToRegExp(pattern: string): RegExp {
  if (pattern === "*") {
    return /^https?:\/\//i;
  }

  let p = pattern.trim();
  // Allow "*://host/path*" style
  const escaped = p
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function urlMatches(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => patternToRegExp(pattern).test(url));
}

export function normalizePageUrl(href: string): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return href;
  }
}
