/**
 * Single-node URI parser — thin dispatcher over the protocol registry.
 *
 * Replaces the old `SingleNodeParser` class which had four separate
 * switch statements. Now: one registry lookup, one method call.
 */

import type { Proxy } from "../core/proxy";
import { getHandlerByUri, isProtocolUri } from "../protocols/registry";
import { logger } from "../lib/logger";

/**
 * Parse a single protocol URI into a `Proxy`.
 *
 * Supports optional chain suffix: `|chain:<tag>`, `|dialer-proxy:<tag>`,
 * or `|detour:<tag>` — these set the proxy's `detour` field.
 *
 * Returns `null` if the scheme is unrecognised or parsing fails.
 */
export function parseSingleUri(uri: string): Proxy | null {
  // Strip optional chain suffix: `ss://...|chain:outbound`
  const chainMatch = uri.match(
    /\|(?:dialer-proxy|detour|chain):(.+)$/i,
  );
  const cleanUri = chainMatch ? uri.slice(0, chainMatch.index) : uri;
  const detourTag = chainMatch?.[1]?.trim();

  const handler = getHandlerByUri(cleanUri);
  if (!handler) {
    logger.debug("unrecognised URI scheme", { uri: cleanUri.slice(0, 40) });
    return null;
  }

  try {
    const proxy = handler.parseUri(cleanUri);

    // Apply chain if present.
    if (detourTag) {
      proxy.detour = detourTag;
    }

    return proxy;
  } catch (e) {
    logger.debug("parse failed", {
      scheme: handler.type,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Parse multiple whitespace- or newline-separated URIs.
 */
export function parseMultipleUris(input: string): Proxy[] {
  const proxies: Proxy[] = [];
  for (const line of input.split(/[\r\n]+/)) {
    for (const token of line.split(/\s+/)) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const proxy = parseSingleUri(trimmed);
      if (proxy) proxies.push(proxy);
    }
  }
  return proxies;
}
