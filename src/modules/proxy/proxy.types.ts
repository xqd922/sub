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

export interface WsOptions {
  path?: string
  headers?: { Host?: string; [key: string]: string | undefined }
}

export interface GrpcOptions {
  'grpc-service-name'?: string
  'grpc-mode'?: string
}

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
  path?: string
  host?: string
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
}

export interface TrojanProxy extends BaseProxy {
  type: 'trojan'
  password: string
  network?: string
  fp?: string
  path?: string
  host?: string
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
}

export interface VlessProxy extends BaseProxy {
  type: 'vless'
  uuid: string
  flow?: string
  encryption?: string
  fp?: string
  network?: string
  path?: string
  host?: string
  reality?: boolean
  'reality-opts'?: {
    'public-key'?: string
    'short-id'?: string
  }
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
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

export type Proxy =
  | SSProxy
  | VmessProxy
  | TrojanProxy
  | VlessProxy
  | Hysteria2Proxy
  | SocksProxy
  | AnyTLSProxy
  | SnellProxy

export interface SingboxTlsConfig {
  enabled: boolean
  server_name: string
  insecure: boolean
  alpn?: string[]
  utls?: { enabled: boolean; fingerprint: string }
  fingerprint?: string
  certificate?: string
  ech?: { enabled: boolean; config?: string; config_path?: string }
  reality?: { enabled: boolean; public_key: string; short_id: string }
  [key: string]: unknown
}

export interface SingboxTransportConfig {
  type: string
  service_name?: string
  idle_timeout?: string
  ping_timeout?: string
  path?: string
  headers?: Record<string, string>
}

export interface SingboxOutbound {
  type: string
  tag: string
  server: string
  server_port: number
  password?: string
  uuid?: string
  tls?: SingboxTlsConfig
  transport?: SingboxTransportConfig
  detour?: string
  [key: string]: unknown
}

export interface ProtocolCodec<T extends Proxy = Proxy> {
  readonly types: ReadonlyArray<T['type']>
  readonly prefixes: readonly string[]
  parse(uri: string): T
  validate(proxy: Proxy): boolean
  toUri?(proxy: T): string | null
  toSingboxOutbound(proxy: T): SingboxOutbound | null
}
