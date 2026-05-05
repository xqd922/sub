/**
 * Subscription parser — auto-detects YAML vs Base64 format.
 *
 * Fetches the subscription URL, inspects the body, and returns a flat
 * list of `Proxy` objects. Deduplication is left to the caller so that
 * multi-source merging (e.g. Gist) can dedup globally.
 */

import type { Proxy } from "../core/proxy";
import type { ClashConfig } from "../core/clash";
import { load as loadYaml } from "js-yaml";
import { getHandlerByUri } from "../protocols/registry";
import { base64Decode } from "../lib/base64";
import { errors } from "../lib/errors";
import { logger } from "../lib/logger";
import { fetchWithRetry } from "./network";

/** Max body size we accept — 10 MiB. */
const MAX_BODY = 10 * 1024 * 1024;

// ── Public API ─────────────────────────────────────────────────

/**
 * Fetch and parse a subscription URL.
 *
 * Uses a fixed ClashX UA so subscription providers return proxy lists
 * instead of landing pages.
 */
export async function parseSubscription(
  url: string,
  signal?: AbortSignal,
): Promise<Proxy[]> {
  logger.debug("parsing subscription", { url });

  const res = await fetchWithRetry(url, {
    retries: 3,
    timeoutMs: 30_000,
    userAgent: "ClashX/1.95.1",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    signal,
  });

  if (!res.ok) {
    throw errors.fetchFailed(`subscription ${res.status}: ${res.statusText}`);
  }

  return parseSubscriptionText(await res.text());
}

export function parseSubscriptionText(text: string): Proxy[] {
  if (!text) {
    throw errors.parseFailed("subscription body is empty");
  }
  if (text.length > MAX_BODY) {
    throw errors.parseFailed(
      `subscription body too large (${(text.length / 1024 / 1024).toFixed(1)} MiB)`,
    );
  }

  return text.includes("proxies:")
    ? parseYaml(text)
    : parseBase64(text);
}

// ── Format detectors ───────────────────────────────────────────

function parseYaml(text: string): Proxy[] {
  try {
    const doc = loadYaml(text) as ClashConfig;
    const proxies = doc?.proxies;
    if (!Array.isArray(proxies)) return [];
    return proxies as Proxy[];
  } catch (e) {
    logger.warn("YAML parse failed, returning empty", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function parseBase64(text: string): Proxy[] {
  let decoded: string;
  try {
    decoded = base64Decode(text.trim());
  } catch {
    // If base64 decoding fails, treat the raw text as plain lines.
    decoded = text;
  }

  const proxies: Proxy[] = [];
  let failed = 0;

  for (const line of decoded.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const handler = getHandlerByUri(trimmed);
    if (!handler) { failed++; continue; }

    try {
      proxies.push(handler.parseUri(trimmed));
    } catch (e) {
      failed++;
      logger.debug("node parse failed", {
        scheme: trimmed.split("://")[0],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (failed > 0) {
    logger.info("subscription parse complete", {
      ok: proxies.length,
      failed,
    });
  }

  return proxies;
}
