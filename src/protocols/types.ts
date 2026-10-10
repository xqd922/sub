// ===== Base =====

export interface BaseProxy {
  name: string
  type: string
  server: string
  port: number
  tls?: boolean
  'skip-cert-verify'?: boolean
  sni?: string
  servername?: string
  udp?: boolean
  tfo?: boolean
  'client-fingerprint'?: string
  alpn?: string[] | string
  fingerprint?: string
  detour?: string
  'dialer-proxy'?: string
  certificate?: string
  'private-key'?: string
}

// ===== Protocol-specific =====

export interface SSProxy extends BaseProxy {
  type: 'ss'
  cipher: string
  password: string
  'encrypt-method'?: string
  obfs?: string
  'obfs-host'?: string
  plugin?: string
  'plugin-opts'?: {
    mode?: string
    host?: string
    [key: string]: string | undefined
  }
}

export interface VmessProxy extends BaseProxy {
  type: 'vmess'
  uuid: string
  alterId?: number
  cipher?: string
  network?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  servername?: string
  path?: string
  host?: string
  'ws-opts'?: {
    path?: string
    headers?: { Host?: string; [key: string]: string | undefined }
  }
  'grpc-opts'?: {
    'grpc-service-name'?: string
    'grpc-mode'?: string
  }
}

export interface TrojanProxy extends BaseProxy {
  type: 'trojan'
  password: string
  network?: string
  fp?: string
  servername?: string
  path?: string
  host?: string
  'ws-opts'?: {
    path?: string
    headers?: { Host?: string; [key: string]: string | undefined }
  }
  'grpc-opts'?: {
    'grpc-service-name'?: string
    'grpc-mode'?: string
  }
}

export interface VlessProxy extends BaseProxy {
  type: 'vless'
  uuid: string
  flow?: string
  encryption?: string
  fp?: string
  servername?: string
  network?: string
  path?: string
  host?: string
  reality?: boolean
  'reality-opts'?: {
    'public-key'?: string
    'short-id'?: string
  }
  'ws-opts'?: {
    path?: string
    headers?: { Host?: string; [key: string]: string | undefined }
  }
  'grpc-opts'?: {
    'grpc-service-name'?: string
    'grpc-mode'?: string
  }
}

export interface Hysteria2Proxy extends BaseProxy {
  type: 'hysteria2'
  password: string
  obfs?: string
  'obfs-password'?: string
  up_mbps?: number
  down_mbps?: number
  up?: string | null
  down?: string | null
  insecure?: boolean
  ports?: string
  mport?: string
}

export interface SocksProxy extends BaseProxy {
  type: 'socks5' | 'socks'
  username?: string
  password?: string
}

export interface AnyTLSProxy extends BaseProxy {
  type: 'anytls'
  password: string
  servername?: string
  'idle-session-check-interval'?: number
  'idle-session-timeout'?: number
  'min-idle-session'?: number
  insecure?: boolean
  'ech-opts'?: {
    enable?: boolean
    config?: string
    'query-server-name'?: string
  }
}

export interface SnellProxy extends BaseProxy {
  type: 'snell'
  psk: string
  version?: number
  reuse?: boolean
  obfs?: string
  'obfs-host'?: string
  'obfs-opts'?: {
    mode?: string
    host?: string
    password?: string
    version?: number
    fingerprint?: string
    'skip-cert-verify'?: boolean
    alpn?: string[]
    [key: string]: unknown
  }
}

// ===== Union =====

export type Proxy =
  | SSProxy
  | VmessProxy
  | TrojanProxy
  | VlessProxy
  | Hysteria2Proxy
  | SocksProxy
  | AnyTLSProxy
  | SnellProxy

// ===== Helpers =====

export function isClashProxy(proxy: Proxy): boolean {
  return proxy.type !== 'socks'
}

export interface ProxyConfig {
  proxies: Proxy[]
  [key: string]: unknown
}
