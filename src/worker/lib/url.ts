/**
 * URL helpers — extraction and normalization used across the codebase.
 * Previously duplicated in 3 different files.
 */

/**
 * Extract a friendly name from a URL.
 * 1. Honour explicit `?name=…` query param.
 * 2. Else honour wrapped `?url=…` then re-extract from the inner URL.
 * 3. Fall back to the hostname.
 */
export function extractNameFromUrl(input: string): string {
  try {
    const u = new URL(input);
    const explicit = u.searchParams.get("name");
    if (explicit) return decodeURIComponent(explicit);

    const wrapped = u.searchParams.get("url");
    if (wrapped) {
      try {
        const inner = new URL(wrapped);
        return inner.hostname;
      } catch {
        // wrapped not a URL — fall through to outer hostname
      }
    }
    return u.hostname;
  } catch {
    return input.slice(0, 64);
  }
}

/**
 * Parse a port string to a number with a fallback.
 * Returns the fallback for empty input, NaN, or out-of-range values.
 */
export function parsePort(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return fallback;
  return Math.floor(n);
}

/** True if the URL points at a Gist (gist.github.com or raw gist content). */
export function isGistUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "gist.github.com" || host === "gist.githubusercontent.com";
  } catch {
    return false;
  }
}

/**
 * Format a byte count as human-readable (e.g. "1.23 GB").
 * Used in subscription user-info parsing.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Safely encode a value for inclusion in a URL path component. */
export function encodePathSegment(s: string): string {
  return encodeURIComponent(s).replace(/'/g, "%27");
}
