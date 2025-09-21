export interface ProxyConfig {
  proxies: Proxy[]
  [key: string]: unknown
}

export interface Proxy {
  name: string
  type: string
  server: string
  port: number
  cipher?: string
  'encrypt-method'?: string  // SS 加密方法 (Clash 格式)
  password?: string
  uuid?: string
  alterId?: number
  network?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  tls?: boolean
  skipCertVerify?: boolean
  sni?: string
  // SS obfs 配置 - Clash 格式
  obfs?: string
  'obfs-host'?: string
  // SS obfs 配置 - 通用格式
  plugin?: string
  'plugin-opts'?: {
    mode?: string
    host?: string
    [key: string]: string | undefined
  }
  'reality-opts'?: {
    'public-key'?: string
    'short-id'?: string
  }
  ports?: string
  mport?: string
  udp?: boolean
  'skip-cert-verify'?: boolean
  flow?: string
  'client-fingerprint'?: string
  servername?: string
  path?: string
  host?: string
  alpn?: string[] | string
  'ws-opts'?: {
    path?: string
    headers?: {
      Host?: string
      [key: string]: string | undefined
    }
  }
  'grpc-opts'?: {
    'grpc-service-name'?: string
    'grpc-mode'?: string
  }
  encryption?: string
  fp?: string

  // 添加 Hysteria2 相关属性
  insecure?: boolean
  up_mbps?: number
  down_mbps?: number

  // 添加 Reality 相关属性
  reality?: boolean

  // 添加 tfo 属性
  tfo?: boolean

  // 添加 dialer-proxy 属性
  'dialer-proxy'?: string
}

export interface DnsConfig {
  enable: boolean
  ipv6: boolean
  listen?: string
  'default-nameserver': string[]
  'enhanced-mode'?: string
  'fake-ip-range': string
  'use-hosts': boolean
  'respect-rules'?: boolean
  'proxy-server-nameserver'?: string[]
  nameserver: string[]
  fallback?: string[]
  'fake-ip-filter'?: string[]
  'fallback-filter'?: {
    geoip: boolean
    'geoip-code'?: string
    geosite?: string[]
    ipcidr: string[]
    domain?: string[]
  }
}

export interface ClashConfig {
  port?: number
  'mixed-port'?: number
  'socks-port'?: number
  'allow-lan': boolean
  'bind-address'?: string
  mode: string
  'log-level': string
  ipv6?: boolean
  'tcp-concurrent'?: boolean
  'external-controller'?: string
  dns?: DnsConfig
  proxies: Proxy[]
  'proxy-groups': ProxyGroup[]
  rules: string[]
  sniffer?: {
    enable?: boolean
    sniff?: {
      TLS?: { ports?: number[], 'override-destination'?: boolean }
      HTTP?: { ports?: number[], 'override-destination'?: boolean }
    }
    'skip-domain'?: string[]
    'parse-pure-ip'?: boolean
    'force-dns-mapping'?: boolean
    'override-destination'?: boolean
  }
}

export interface ProxyGroup {
  name: string
  type: string
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
}

// 添加错误相关类型
export interface SubscriptionError extends Error {
  code: string;
  statusCode?: number | undefined;
  details?: unknown | undefined;
}

export class SubscriptionFetchError extends Error implements SubscriptionError {
  code: string;
  statusCode?: number | undefined;
  details?: unknown | undefined;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'SubscriptionFetchError';
    this.code = 'SUB_FETCH_ERROR';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Sing-box 配置类型定义
export interface SingboxTLSConfig {
  enabled: boolean;
  server_name: string;
  insecure: boolean;
}

export interface SingboxTransportConfig {
  type: string;
  service_name?: string;
  idle_timeout?: string;
  ping_timeout?: string;
  path?: string;
  headers?: Record<string, string>;
}

export interface SingboxProxyConfig {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  password?: string;
  uuid?: string;
  tls?: SingboxTLSConfig;
  transport?: SingboxTransportConfig;
  [key: string]: unknown;
} 