/**
 * Clash / Mihomo proxy and config types.
 *
 * We deliberately keep these close to the YAML shape to avoid a separate
 * serialization layer — `js-yaml` writes them out directly.
 */

export interface ClashProxyBase {
  name: string;
  type: string;
  server: string;
  port: number;
  udp?: boolean;
  "dialer-proxy"?: string;
}

export interface ClashShadowsocks extends ClashProxyBase {
  type: "ss";
  cipher: string;
  password: string;
  plugin?: string;
  "plugin-opts"?: Record<string, unknown>;
}

export interface ClashVmess extends ClashProxyBase {
  type: "vmess";
  uuid: string;
  alterId: number;
  cipher: string;
  tls?: boolean;
  servername?: string;
  "skip-cert-verify"?: boolean;
  network?: string;
  "ws-opts"?: { path?: string; headers?: Record<string, string> };
  "grpc-opts"?: { "grpc-service-name": string };
}

export interface ClashVless extends ClashProxyBase {
  type: "vless";
  uuid: string;
  flow?: string;
  tls?: boolean;
  servername?: string;
  "skip-cert-verify"?: boolean;
  "client-fingerprint"?: string;
  "reality-opts"?: { "public-key": string; "short-id"?: string };
  network?: string;
  "ws-opts"?: { path?: string; headers?: Record<string, string> };
  "grpc-opts"?: { "grpc-service-name": string };
}

export interface ClashTrojan extends ClashProxyBase {
  type: "trojan";
  password: string;
  sni?: string;
  "skip-cert-verify"?: boolean;
  network?: string;
  "ws-opts"?: { path?: string; headers?: Record<string, string> };
}

export interface ClashHysteria2 extends ClashProxyBase {
  type: "hysteria2";
  password: string;
  sni?: string;
  "skip-cert-verify"?: boolean;
  obfs?: string;
  "obfs-password"?: string;
  up?: string;
  down?: string;
}

export interface ClashSocks5 extends ClashProxyBase {
  type: "socks5";
  username?: string;
  password?: string;
  tls?: boolean;
}

export interface ClashAnyTls extends ClashProxyBase {
  type: "anytls";
  password: string;
  sni?: string;
  "skip-cert-verify"?: boolean;
  "idle-session-check-interval"?: number;
  "idle-session-timeout"?: number;
}

export type ClashProxy =
  | ClashShadowsocks
  | ClashVmess
  | ClashVless
  | ClashTrojan
  | ClashHysteria2
  | ClashSocks5
  | ClashAnyTls;

export interface ClashProxyGroup {
  name: string;
  type: "select" | "url-test" | "fallback" | "load-balance";
  proxies: string[];
  url?: string;
  interval?: number;
  tolerance?: number;
}

export interface ClashRuleProvider {
  type: "http";
  behavior: "domain" | "ipcidr" | "classical";
  url: string;
  path: string;
  interval: number;
  format?: "yaml" | "text" | "mrs";
}

export interface ClashConfig {
  port?: number;
  "socks-port"?: number;
  "mixed-port": number;
  "allow-lan": boolean;
  mode: "rule" | "global" | "direct";
  "log-level": string;
  ipv6: boolean;
  "external-controller"?: string;
  dns: Record<string, unknown>;
  proxies: ClashProxy[];
  "proxy-groups": ClashProxyGroup[];
  "rule-providers": Record<string, ClashRuleProvider>;
  rules: string[];
  // Mihomo-only extras kept as-is.
  [key: string]: unknown;
}
