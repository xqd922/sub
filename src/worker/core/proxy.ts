/**
 * Discriminated union of every supported proxy protocol.
 *
 * Why a union (not one fat interface): each protocol has incompatible fields.
 * `cipher` is mandatory for shadowsocks but meaningless for vless. Modeling
 * them as one optional-everything interface defeats `noUncheckedIndexedAccess`
 * and forces consumers to guess. With a discriminator, exhaustive switches
 * over `proxy.type` are statically checked.
 */

// ── Common shape carried by every proxy ─────────────────────────
interface ProxyBase {
  /** Display name, e.g. "🇯🇵 Japan 01 [2x]". */
  name: string;
  /** Hostname or IP. */
  server: string;
  /** TCP/UDP port (1..65535). */
  port: number;
  /** Whether UDP relay is supported. Defaults to false. */
  udp?: boolean;
  /** Bandwidth multiplier extracted from name (e.g. "2x", "0.5x"). */
  multiplier?: number;
  /** Proxy chain — `detour` in Sing-box, `dialer-proxy` in Clash. */
  detour?: string;
  /** Free-form region code derived from name flag/keywords. */
  region?: string;
}

// ── Transport options shared by v2ray-family protocols ──────────
export interface WsTransport {
  type: "ws";
  path?: string;
  headers?: Record<string, string>;
  earlyDataHeaderName?: string;
  maxEarlyData?: number;
}

export interface GrpcTransport {
  type: "grpc";
  serviceName: string;
}

export interface H2Transport {
  type: "h2";
  host?: string[];
  path?: string;
}

export type Transport = WsTransport | GrpcTransport | H2Transport;

// ── TLS options ─────────────────────────────────────────────────
export interface TlsOptions {
  enabled: true;
  serverName?: string;
  insecure?: boolean;
  alpn?: string[];
  fingerprint?: string;
  /** Reality protocol options (vless only). */
  reality?: {
    publicKey: string;
    shortId?: string;
  };
}

// ── Per-protocol shapes ────────────────────────────────────────-
export interface ShadowsocksProxy extends ProxyBase {
  type: "ss";
  cipher: string;
  password: string;
  plugin?: string;
  pluginOpts?: Record<string, string | number | boolean>;
}

export interface VmessProxy extends ProxyBase {
  type: "vmess";
  uuid: string;
  alterId: number;
  cipher: "auto" | "aes-128-gcm" | "chacha20-poly1305" | "none";
  tls?: TlsOptions;
  transport?: Transport;
}

export interface VlessProxy extends ProxyBase {
  type: "vless";
  uuid: string;
  flow?: "xtls-rprx-vision" | "";
  tls?: TlsOptions;
  transport?: Transport;
}

export interface TrojanProxy extends ProxyBase {
  type: "trojan";
  password: string;
  tls: TlsOptions; // trojan implies TLS
  transport?: Transport;
}

export interface Hysteria2Proxy extends ProxyBase {
  type: "hysteria2";
  password: string;
  tls: TlsOptions;
  obfs?: { type: "salamander"; password: string };
  upMbps?: number;
  downMbps?: number;
}

export interface SocksProxy extends ProxyBase {
  type: "socks5";
  username?: string;
  password?: string;
  tls?: TlsOptions;
}

export interface AnyTlsProxy extends ProxyBase {
  type: "anytls";
  password: string;
  tls: TlsOptions;
  idleSessionCheckInterval?: number;
  idleSessionTimeout?: number;
}

// ── Public union ────────────────────────────────────────────────
export type Proxy =
  | ShadowsocksProxy
  | VmessProxy
  | VlessProxy
  | TrojanProxy
  | Hysteria2Proxy
  | SocksProxy
  | AnyTlsProxy;

export type ProxyType = Proxy["type"];

/** All protocol scheme prefixes recognised in URIs. */
export const PROXY_SCHEMES = [
  "ss",
  "vmess",
  "vless",
  "trojan",
  "hysteria2",
  "hy2",
  "socks5",
  "socks",
  "anytls",
] as const;

export type ProxyScheme = (typeof PROXY_SCHEMES)[number];
