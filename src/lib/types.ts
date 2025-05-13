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
  password?: string
  uuid?: string
  alterId?: number
  network?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  tls?: boolean
  skipCertVerify?: boolean
  sni?: string
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
    }
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
  'default-nameserver': string[]
  'enhanced-mode': string
  'fake-ip-range': string
  'use-hosts': boolean
  'respect-rules': boolean
  'proxy-server-nameserver': string[]
  nameserver: string[]
  fallback?: string[]
  'fallback-filter': {
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
  statusCode?: number;
  details?: unknown;
}

export class SubscriptionFetchError extends Error implements SubscriptionError {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'SubscriptionFetchError';
    this.code = 'SUB_FETCH_ERROR';
    this.statusCode = statusCode;
    this.details = details;
  }
} 