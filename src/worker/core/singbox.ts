/**
 * Sing-box outbound types — the JSON shape that lands in the generated config.
 * These mirror the official sing-box schema closely; we only model fields we emit.
 */

interface SingboxOutboundBase {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  detour?: string;
}

export interface SingboxTlsBlock {
  enabled: true;
  server_name?: string;
  insecure?: boolean;
  alpn?: string[];
  utls?: { enabled: true; fingerprint: string };
  reality?: { enabled: true; public_key: string; short_id?: string };
}

export interface SingboxTransportBlock {
  type: "ws" | "grpc" | "http";
  path?: string;
  headers?: Record<string, string>;
  service_name?: string;
  early_data_header_name?: string;
  max_early_data?: number;
}

export interface SingboxShadowsocksOutbound extends SingboxOutboundBase {
  type: "shadowsocks";
  method: string;
  password: string;
  plugin?: string;
  plugin_opts?: string;
  udp_over_tcp?: boolean;
}

export interface SingboxVmessOutbound extends SingboxOutboundBase {
  type: "vmess";
  uuid: string;
  alter_id: number;
  security: string;
  tls?: SingboxTlsBlock;
  transport?: SingboxTransportBlock;
}

export interface SingboxVlessOutbound extends SingboxOutboundBase {
  type: "vless";
  uuid: string;
  flow?: string;
  tls?: SingboxTlsBlock;
  transport?: SingboxTransportBlock;
}

export interface SingboxTrojanOutbound extends SingboxOutboundBase {
  type: "trojan";
  password: string;
  tls: SingboxTlsBlock;
  transport?: SingboxTransportBlock;
}

export interface SingboxHysteria2Outbound extends SingboxOutboundBase {
  type: "hysteria2";
  password: string;
  tls: SingboxTlsBlock;
  obfs?: { type: "salamander"; password: string };
  up_mbps?: number;
  down_mbps?: number;
}

export interface SingboxSocksOutbound extends SingboxOutboundBase {
  type: "socks";
  version: "5";
  username?: string;
  password?: string;
}

export interface SingboxAnyTlsOutbound extends SingboxOutboundBase {
  type: "anytls";
  password: string;
  tls: SingboxTlsBlock;
  idle_session_check_interval?: string;
  idle_session_timeout?: string;
}

export type SingboxOutbound =
  | SingboxShadowsocksOutbound
  | SingboxVmessOutbound
  | SingboxVlessOutbound
  | SingboxTrojanOutbound
  | SingboxHysteria2Outbound
  | SingboxSocksOutbound
  | SingboxAnyTlsOutbound;
