import type { Proxy } from "../core/proxy";
import { detectRegion } from "./region";

/**
 * Proxy renaming — turns "节点-洛杉矶-2倍率-001" into "🇺🇸 United States 03 [2x]".
 *
 * Side effects on the proxy: we also write `proxy.multiplier` so downstream
 * filters (e.g. the Min low-multiplier proxy group) can use a structured
 * field rather than re-parsing the name.
 */

export interface FormatOptions {
  /** Use ISO codes ("HK") instead of full names ("Hong Kong"). */
  short?: boolean;
  /** Optional shared counter so multiple batches keep monotonic numbering. */
  counters?: Record<string, number>;
}

export function formatProxies(proxies: Proxy[], opts: FormatOptions = {}): Proxy[] {
  const counters = opts.counters ?? {};
  return proxies.map((p) => formatOne(p, counters, opts.short ?? false));
}

export function formatOneShort(
  proxy: Proxy,
  counters: Record<string, number> = {},
): Proxy {
  return formatOne(proxy, counters, true);
}

function formatOne(
  proxy: Proxy,
  counters: Record<string, number>,
  short: boolean,
): Proxy {
  const region = detectRegion(proxy.name);
  if (!region) return proxy;

  const multiplier = extractMultiplier(proxy.name);
  const ipv6 = isIpv6Marker(proxy.name);

  const display = short
    ? `${region.flag} ${region.code}`
    : `${region.flag} ${region.name}`;
  const counterKey = short ? `short-${region.code}` : region.name;

  counters[counterKey] = (counters[counterKey] ?? 0) + 1;
  const num = String(counters[counterKey]).padStart(2, "0");

  const tags: string[] = [];
  if (ipv6) tags.push("IPv6");
  if (multiplier !== undefined && multiplier !== 1) tags.push(`${multiplier}x`);
  const suffix = tags.length > 0 ? ` [${tags.join("·")}]` : "";

  return {
    ...proxy,
    name: `${display} ${num}${suffix}`,
    region: region.code,
    ...(multiplier !== undefined && { multiplier }),
  };
}

// ── Internal extractors ────────────────────────────────────────

function isIpv6Marker(name: string): boolean {
  return /ipv6|ip6|v6|双栈/i.test(name);
}

/**
 * Extract a bandwidth multiplier from the node name.
 * Patterns supported:
 *   `倍率:1.5` / `倍率：2`
 *   `[2x]` / `【2x】` / `(2x)`
 *   `2x` / `2×` / `2倍`
 *   `x2` / `*2`
 */
function extractMultiplier(name: string): number | undefined {
  const patterns: RegExp[] = [
    /倍率[：:](\d+\.?\d*)/,
    /[【\[(](\d+\.?\d*)[xX×][】\])]/,
    /(\d+\.?\d*)[xX×倍]/,
    /[xX×*](\d+\.?\d*)/,
  ];
  for (const re of patterns) {
    const match = re.exec(name);
    if (match) {
      const n = Number.parseFloat(match[1]!);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}
