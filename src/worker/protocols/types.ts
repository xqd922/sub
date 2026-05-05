import type { Proxy, ProxyType } from "../core/proxy";
import type { ClashProxy } from "../core/clash";
import type { SingboxOutbound } from "../core/singbox";

/**
 * Contract every protocol implementation must satisfy.
 *
 * Why this exists: previously the same protocol switch was duplicated
 * in 4 places (parse, toUri, toSingbox, dedupKey). Adding a protocol
 * meant editing 4 files. With this interface + a registry, each protocol
 * is fully self-contained in one file and registered once.
 */
export interface ProtocolHandler<P extends Proxy = Proxy> {
  /** Discriminator that identifies this protocol in the Proxy union. */
  readonly type: P["type"];
  /** URI scheme(s) recognised in subscription/single-node input. */
  readonly schemes: readonly string[];

  /** Parse a URI into a Proxy. Throws ProtocolParseError on invalid input. */
  parseUri(uri: string): P;

  /** Serialize a Proxy back into its URI form. */
  toUri(proxy: P): string;

  /** Convert a Proxy to a Sing-box outbound JSON. */
  toSingbox(proxy: P): SingboxOutbound;

  /** Convert a Proxy to a Clash YAML proxy entry. */
  toClash(proxy: P): ClashProxy;

  /**
   * Stable dedup key. Two proxies with the same key are considered
   * functionally identical (excluding name and multiplier).
   */
  dedupKey(proxy: P): string;
}

/** Map from `Proxy.type` discriminator to its handler. */
export type HandlerMap = { [T in ProxyType]: ProtocolHandler<Extract<Proxy, { type: T }>> };
