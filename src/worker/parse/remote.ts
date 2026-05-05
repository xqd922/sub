/**
 * Remote / Gist node fetcher.
 *
 * Fetches a plain-text list that may contain:
 *   - Protocol URIs (ss://, vmess://, …) — parsed in-place
 *   - Subscription URLs (https://…) — fetched and parsed as subscriptions
 *
 * Name conflicts between subscription and single nodes are resolved
 * by formatting conflict nodes with the short-region display.
 */

import type { Proxy } from "../core/proxy";
import { parseSubscription } from "./subscription";
import { parseSingleUri } from "./single";
import { fetchWithRetry } from "./network";
import { deduplicateProxies } from "../format/dedup";
import { formatProxies, formatOneShort } from "../format/proxy";
import { isProtocolUri } from "../protocols/registry";
import { errors } from "../lib/errors";
import { logger } from "../lib/logger";

const SUB_PREFIXES = ["http://", "https://"];

function isSingleNodeLine(line: string): boolean {
  const clean = line.replace(/\|(?:dialer-proxy|detour|chain):.+$/i, "");
  return isProtocolUri(clean);
}

export interface RemoteResult {
  proxies: Proxy[];
  hasSubscriptionUrls: boolean;
}

/**
 * Fetch a remote Gist-style URL and parse all nodes.
 */
export async function fetchNodesFromRemote(
  url: string,
  signal?: AbortSignal,
): Promise<RemoteResult> {
  logger.debug("fetching remote nodes", { url });

  const res = await fetchWithRetry(url, {
    retries: 2,
    timeoutMs: 15_000,
    uaRotation: ["clash.meta/v1.19.13", "mihomo/v1.18.5"],
    signal,
  });

  if (!res.ok) {
    throw errors.fetchFailed(`remote ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Classify each line.
  const singleLines: string[] = [];
  const subLines: string[] = [];
  const order: Array<{ kind: "single" | "sub"; idx: number }> = [];

  for (const line of lines) {
    if (isSingleNodeLine(line)) {
      order.push({ kind: "single", idx: singleLines.length });
      singleLines.push(line);
    } else if (SUB_PREFIXES.some((p) => line.startsWith(p))) {
      order.push({ kind: "sub", idx: subLines.length });
      subLines.push(line);
    }
  }

  const hasSubscriptionUrls = subLines.length > 0;

  // 1. Fetch subscriptions first (with shared counter for monotonic numbering).
  const subResults: Proxy[][] = [];
  const sharedCounters: Record<string, number> = {};

  for (const subUrl of subLines) {
    try {
      const raw = await parseSubscription(subUrl, signal);
      subResults.push(formatProxies(raw, { counters: sharedCounters }));
    } catch (e) {
      logger.warn("remote subscription failed, skipping", {
        url: subUrl,
        error: e instanceof Error ? e.message : String(e),
      });
      subResults.push([]);
    }
  }

  const subscriptionProxies = subResults.flat();
  const subNames = new Set(subscriptionProxies.map((p) => p.name));
  logger.info("remote subscription nodes", { count: subscriptionProxies.length });

  // 2. Parse single nodes.
  const singleProxies: Proxy[] = [];
  for (const line of singleLines) {
    const proxy = parseSingleUri(line);
    if (proxy) singleProxies.push(proxy);
  }

  // 3. Format single nodes whose names conflict with subscription nodes.
  const conflictCounters: Record<string, number> = {};
  const formattedSingles = singleProxies.map((p) => {
    if (!subNames.has(p.name)) return p;
    return formatOneShort(p, conflictCounters);
  });

  logger.info("remote single nodes", { count: formattedSingles.length });

  // 4. Merge in original order.
  const merged: Proxy[] = [];
  let si = 0;
  for (const item of order) {
    if (item.kind === "single") {
      if (si < formattedSingles.length) merged.push(formattedSingles[si++]!);
    } else {
      const batch = subResults[item.idx];
      if (batch) merged.push(...batch);
    }
  }

  // 5. Global dedup (keep first occurrence).
  const deduped = deduplicateProxies(merged, { keepStrategy: "first", verbose: true });
  logger.info("remote final nodes", { count: deduped.length });

  return { proxies: deduped, hasSubscriptionUrls };
}
