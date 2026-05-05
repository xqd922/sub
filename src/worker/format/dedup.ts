import type { Proxy } from "../core/proxy";
import { getHandlerByType } from "../protocols/registry";
import { logger } from "../lib/logger";

/**
 * Deduplicate and validate parsed proxies.
 *
 * Replaces the previous 86-line per-protocol switch — the `dedupKey` is
 * delegated to each protocol handler, so adding a protocol no longer
 * requires editing this file.
 */

// ── Filter rules ──────────────────────────────────────────────

const INFO_NODE_KEYWORDS = [
  "官网", "剩余流量", "距离下次重置", "套餐到期", "套餐时间", "订阅",
  "过期时间", "流量重置", "建议", "到期", "更新", "重置",
  "流量", "expire", "traffic",
] as const;

const INVALID_SERVERS = new Set([
  "127.0.0.1", "localhost", "0.0.0.0", "::1",
  // Public DNS — almost certainly an info-node misconfiguration.
  "1.1.1.1", "8.8.8.8", "8.8.4.4",
  "114.114.114.114", "223.5.5.5", "223.6.6.6",
]);

const INVALID_SERVER_PATTERNS: readonly RegExp[] = [
  /^192\.168\.\d+\.\d+$/, // RFC1918
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // link-local
  /^fc00:/i, /^fe80:/i, /^::$/,
  /^example\./i, /^test\./i, /^localhost$/i,
  /\.local$/i, /\.example$/i, /\.test$/i, /\.invalid$/i,
];

function isInfoNode(p: Proxy): boolean {
  const name = p.name.toLowerCase();
  return INFO_NODE_KEYWORDS.some((k) => name.includes(k.toLowerCase()));
}

function isInvalidNode(p: Proxy): boolean {
  const server = p.server?.trim().toLowerCase();
  if (!server) return true;
  if (!p.port || p.port < 1 || p.port > 65535) return true;
  if (INVALID_SERVERS.has(server)) return true;
  return INVALID_SERVER_PATTERNS.some((re) => re.test(server));
}

// ── Public API ────────────────────────────────────────────────

export interface DedupOptions {
  filterInfoNodes?: boolean;
  /** When two proxies collide, which one to keep. */
  keepStrategy?: "shorter" | "first" | "last";
  /** Emit summary log. */
  verbose?: boolean;
}

export interface DedupStats {
  original: number;
  infoNodes: number;
  invalidNodes: number;
  duplicates: number;
  valid: number;
}

export function deduplicateProxies(
  proxies: readonly Proxy[],
  options: DedupOptions = {},
): Proxy[] {
  const { filterInfoNodes = true, keepStrategy = "shorter", verbose = false } = options;
  const seen = new Map<string, Proxy>();
  let infoNodesCount = 0;
  let invalidNodesCount = 0;
  let duplicateCount = 0;

  for (const proxy of proxies) {
    if (isInvalidNode(proxy)) {
      invalidNodesCount++;
      continue;
    }
    if (filterInfoNodes && isInfoNode(proxy)) {
      infoNodesCount++;
      continue;
    }
    const key = keyOf(proxy);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, proxy);
      continue;
    }
    duplicateCount++;
    if (keepStrategy === "shorter" && proxy.name.length < existing.name.length) {
      seen.set(key, proxy);
    } else if (keepStrategy === "last") {
      seen.set(key, proxy);
    }
  }

  if (verbose && (infoNodesCount > 0 || invalidNodesCount > 0 || duplicateCount > 0)) {
    logger.info("dedup summary", {
      original: proxies.length,
      invalid: invalidNodesCount,
      info: infoNodesCount,
      duplicates: duplicateCount,
      valid: seen.size,
    });
  }

  return [...seen.values()];
}

export function getDedupStats(proxies: readonly Proxy[]): DedupStats {
  const seen = new Set<string>();
  let infoNodes = 0;
  let invalidNodes = 0;
  let duplicates = 0;
  for (const p of proxies) {
    if (isInvalidNode(p)) { invalidNodes++; continue; }
    if (isInfoNode(p)) { infoNodes++; continue; }
    const k = keyOf(p);
    if (seen.has(k)) duplicates++;
    else seen.add(k);
  }
  return { original: proxies.length, infoNodes, invalidNodes, duplicates, valid: seen.size };
}

/**
 * Append `(N)` to duplicate names so consumers (Clash YAML especially)
 * don't reject the config for non-unique proxy names.
 */
export function ensureUniqueNames(proxies: readonly Proxy[]): Proxy[] {
  const counts = new Map<string, number>();
  return proxies.map((p) => {
    const n = (counts.get(p.name) ?? 0) + 1;
    counts.set(p.name, n);
    return n === 1 ? p : { ...p, name: `${p.name} (${n})` };
  });
}

function keyOf(proxy: Proxy): string {
  // Type-safe registry dispatch — TS knows the handler matches the proxy type.
  // We cast to any only to satisfy the generic constraint inside the call site.
  const handler = getHandlerByType(proxy.type) as { dedupKey(p: Proxy): string };
  return handler.dedupKey(proxy);
}
