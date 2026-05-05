import type { Proxy, ProxyType } from "../core/proxy";
import type { HandlerMap, ProtocolHandler } from "./types";

/**
 * Single source of truth for protocol dispatch.
 *
 * Adding a protocol = implement ProtocolHandler in a new file, register here.
 * No other file needs to know the new protocol exists.
 */

// Lazy registration — populated by `registerProtocol` calls in protocol files.
const byType = new Map<ProxyType, ProtocolHandler>();
const bySchemeName = new Map<string, ProtocolHandler>();

export function registerProtocol<T extends ProxyType>(
  handler: ProtocolHandler<Extract<Proxy, { type: T }>>,
): void {
  if (byType.has(handler.type)) {
    throw new Error(`Protocol ${handler.type} already registered`);
  }
  byType.set(handler.type, handler as ProtocolHandler);
  for (const scheme of handler.schemes) {
    bySchemeName.set(scheme.toLowerCase(), handler as ProtocolHandler);
  }
}

/** Get handler by Proxy discriminator type. Throws if missing — registry is exhaustive at boot. */
export function getHandlerByType<T extends ProxyType>(
  type: T,
): HandlerMap[T] {
  const handler = byType.get(type);
  if (!handler) {
    throw new Error(`No handler registered for proxy type "${type}"`);
  }
  return handler as HandlerMap[T];
}

/** Get handler from a URI string by inspecting the scheme prefix. Returns null if unsupported. */
export function getHandlerByUri(uri: string): ProtocolHandler | null {
  const colon = uri.indexOf("://");
  if (colon < 0) return null;
  const scheme = uri.slice(0, colon).toLowerCase();
  return bySchemeName.get(scheme) ?? null;
}

/** Convenience helper used by single-URI parser and dedup. */
export function isProtocolUri(input: string): boolean {
  return getHandlerByUri(input) !== null;
}

/** Iterate registered handlers — useful for tests and diagnostics. */
export function listHandlers(): readonly ProtocolHandler[] {
  return [...byType.values()];
}

/**
 * Side-effect import that registers every protocol in one place.
 * Routes/services depend on this barrel so the registry is always primed
 * before the first request is served.
 */
export async function initProtocolRegistry(): Promise<void> {
  // Dynamic imports run once; their top-level `registerProtocol` calls
  // populate the maps above.
  await import("./shadowsocks");
  await import("./vmess");
  await import("./vless");
  await import("./trojan");
  await import("./hysteria2");
  await import("./socks");
  await import("./anytls");
}
