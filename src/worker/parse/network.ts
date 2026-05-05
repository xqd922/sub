/**
 * Thin, stateless fetch wrapper with retry + timeout.
 *
 * Unlike the old `NetService` (class-of-statics with global mutable stats),
 * this module exports plain functions. Network stats belong at the route
 * handler level, not buried inside a fetch helper.
 */

import { logger } from "../lib/logger";

export interface FetchOptions {
  /** Max attempts (default 3). */
  retries?: number;
  /** Per-attempt timeout in ms (default 30 000). */
  timeoutMs?: number;
  /** Base delay for exponential back-off in ms (default 1 000). */
  baseDelayMs?: number;
  /** HTTP method (default GET). */
  method?: string;
  /** Request body for POST/PATCH style calls. */
  body?: BodyInit;
  /** Override the User-Agent header. */
  userAgent?: string;
  /** Additional headers merged on top of defaults. */
  headers?: Record<string, string>;
  /** Forward caller's AbortSignal. */
  signal?: AbortSignal;
  /** On retry, rotate through these UAs instead of using `userAgent`. */
  uaRotation?: readonly string[];
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

const UA_ROTATION = [
  "clash.meta/v1.19.13",
  "mihomo/v1.18.5",
] as const;

// ── Public ─────────────────────────────────────────────────────

/**
 * Fetch with retry, timeout, and exponential back-off.
 *
 * Returns the raw `Response` on success; throws on exhaustion.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 30_000,
    baseDelayMs = 1_000,
    method,
    body,
    userAgent,
    headers = {},
    signal,
    uaRotation,
  } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    const ua =
      userAgent ??
      (uaRotation
        ? uaRotation[attempt % uaRotation.length]
        : UA_ROTATION[attempt % UA_ROTATION.length]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Wire caller's signal so external aborts propagate.
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      logger.debug("fetch attempt", { attempt: attempt + 1, retries, ua });

      const res = await fetch(url, {
        method,
        headers: { ...DEFAULT_HEADERS, ...(ua && { "User-Agent": ua }), ...headers },
        body,
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
      lastError = err;

      logger.warn("fetch failed", {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });

      if (attempt < retries - 1) {
        const wait = baseDelayMs * 2 ** attempt;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Convenience: fetch + parse JSON.  Throws on non-2xx or unparseable body.
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await fetchWithRetry(url, opts);
  return (await res.json()) as T;
}
