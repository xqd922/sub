export interface EchOptions {
  enable?: boolean
  config?: string
  'query-server-name'?: string
}

export interface ShadowTlsOptions {
  password?: string
  version?: number
  host?: string
  sni?: string
  fingerprint?: string
  'skip-cert-verify'?: boolean
  alpn?: string[]
}

export interface SmuxBrutalOptions {
  enabled?: boolean
  up?: string
  down?: string
}

export interface SmuxOptions {
  enabled?: boolean
  protocol?: string
  'max-connections'?: number
  'min-streams'?: number
  'max-streams'?: number
  padding?: boolean
  statistic?: boolean
  'only-tcp'?: boolean
  'brutal-opts'?: SmuxBrutalOptions
}

export interface RealityOptions {
  'public-key'?: string
  'short-id'?: string
  'support-x25519mlkem768'?: boolean
  'spider-x'?: string
}

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
  certificate?: string
  'private-key'?: string
  'ech-opts'?: EchOptions
  'shadow-tls-opts'?: ShadowTlsOptions
  smux?: SmuxOptions
  detour?: string
  'dialer-proxy'?: string
}

export interface WsOptions {
  path?: string
  headers?: { Host?: string; [key: string]: string | undefined }
  'max-early-data'?: number
  'early-data-header-name'?: string
  'v2ray-http-upgrade'?: boolean
  'v2ray-http-upgrade-fast-open'?: boolean
}

export interface GrpcOptions {
  'grpc-service-name'?: string
  'grpc-mode'?: string
  'grpc-user-agent'?: string
  'ping-interval'?: number
  'max-connections'?: number
  'min-streams'?: number
  'max-streams'?: number
}

export interface HttpTransportOptions {
  method?: string
  path?: string[]
  headers?: Record<string, string[]>
}

export interface H2Options {
  host?: string[]
  path?: string
}

export interface XhttpReuseSettings {
  'max-concurrency'?: string
  'max-connections'?: string
  'c-max-reuse-times'?: string
  'h-max-request-times'?: string
  'h-max-reusable-secs'?: string
  'h-keep-alive-period'?: number
}

export interface XhttpDownloadSettings {
  path?: string
  host?: string
  headers?: Record<string, string>
  'reuse-settings'?: XhttpReuseSettings
  server?: string
  port?: number
  tls?: boolean
  alpn?: string[]
  'ech-opts'?: EchOptions
  'reality-opts'?: RealityOptions
  'skip-cert-verify'?: boolean
  fingerprint?: string
  certificate?: string
  'private-key'?: string
  servername?: string
  'client-fingerprint'?: string
}

export interface XhttpOptions {
  path?: string
  host?: string
  mode?: string
  headers?: Record<string, string>
  'no-grpc-header'?: boolean
  'x-padding-bytes'?: string
  'x-padding-obfs-mode'?: boolean
  'x-padding-key'?: string
  'x-padding-header'?: string
  'x-padding-placement'?: string
  'x-padding-method'?: string
  'uplink-http-method'?: string
  'session-placement'?: string
  'session-key'?: string
  'session-table'?: string
  'session-length'?: string
  'seq-placement'?: string
  'seq-key'?: string
  'uplink-data-placement'?: string
  'uplink-data-key'?: string
  'uplink-chunk-size'?: string | number
  'sc-max-each-post-bytes'?: string | number
  'sc-min-posts-interval-ms'?: string | number
  'reuse-settings'?: XhttpReuseSettings
  'download-settings'?: XhttpDownloadSettings
  /** 保留原始 extra JSON 以便 URI 无损回写 */
  _rawExtra?: string
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
    path?: string
    tls?: boolean
    mux?: boolean
    password?: string
    version?: number
    fingerprint?: string
    'skip-cert-verify'?: boolean
    alpn?: string[]
    headers?: Record<string, string>
    'v2ray-http-upgrade'?: boolean
    'v2ray-http-upgrade-fast-open'?: boolean
    [key: string]: unknown
  }
  'udp-over-tcp'?: boolean
  'udp-over-tcp-version'?: number
}

export interface SSRProxy extends BaseProxy {
  type: 'ssr'
  cipher: string
  password: string
  obfs: string
  'obfs-param'?: string
  protocol: string
  'protocol-param'?: string
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
  'packet-encoding'?: string
  xudp?: boolean
  'packet-addr'?: boolean
  'global-padding'?: boolean
  'authenticated-length'?: boolean
  'reality-opts'?: RealityOptions
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
  'http-opts'?: HttpTransportOptions
  'h2-opts'?: H2Options
}

export interface TrojanProxy extends BaseProxy {
  type: 'trojan'
  password: string
  network?: string
  fp?: string
  path?: string
  host?: string
  'reality-opts'?: RealityOptions
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
  'ss-opts'?: {
    enabled?: boolean
    method?: string
    password?: string
  }
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
  'packet-encoding'?: string
  xudp?: boolean
  'packet-addr'?: boolean
  reality?: boolean
  'reality-opts'?: RealityOptions
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
  'http-opts'?: HttpTransportOptions
  'h2-opts'?: H2Options
  'xhttp-opts'?: XhttpOptions
}

export interface HysteriaProxy extends BaseProxy {
  type: 'hysteria'
  ports?: string
  mport?: string
  protocol?: string
  'obfs-protocol'?: string
  up?: string | null
  down?: string | null
  'up-speed'?: number
  'down-speed'?: number
  up_mbps?: number
  down_mbps?: number
  auth?: string
  'auth-str'?: string
  auth_str?: string
  obfs?: string
  'recv-window-conn'?: number
  'recv-window'?: number
  'disable-mtu-discovery'?: boolean
  'fast-open'?: boolean
  'hop-interval'?: number | string
  insecure?: boolean
}

export interface Hysteria2RealmOptions {
  enable?: boolean
  'server-url'?: string
  token?: string
  'realm-id'?: string
  'stun-servers'?: string[]
  sni?: string
  'skip-cert-verify'?: boolean
  fingerprint?: string
  certificate?: string
  'private-key'?: string
  alpn?: string[]
}

export interface Hysteria2Proxy extends BaseProxy {
  type: 'hysteria2'
  password: string
  obfs?: string
  'obfs-password'?: string
  'obfs-min-packet-size'?: number
  'obfs-max-packet-size'?: number
  up_mbps?: number
  down_mbps?: number
  up?: string | null
  down?: string | null
  insecure?: boolean
  ports?: string
  mport?: string
  'hop-interval'?: string | number
  cwnd?: number
  'bbr-profile'?: string
  'udp-mtu'?: number
  'handshake-timeout'?: number
  'realm-opts'?: Hysteria2RealmOptions
}

export interface TuicProxy extends BaseProxy {
  type: 'tuic'
  uuid?: string
  password?: string
  token?: string
  ip?: string
  'heartbeat-interval'?: number
  'reduce-rtt'?: boolean
  'request-timeout'?: number
  'udp-relay-mode'?: string
  'congestion-controller'?: string
  'disable-sni'?: boolean
  'max-udp-relay-packet-size'?: number
  'fast-open'?: boolean
  'max-open-streams'?: number
  cwnd?: number
  'bbr-profile'?: string
  'recv-window-conn'?: number
  'recv-window'?: number
  'disable-mtu-discovery'?: boolean
  'udp-over-stream'?: boolean
  'udp-over-stream-version'?: number
}

export interface SocksProxy extends BaseProxy {
  type: 'socks5' | 'socks'
  version?: '4' | '4a' | '5' | number
  username?: string
  password?: string
  'udp-over-tcp'?: boolean
}

export interface HttpProxy extends BaseProxy {
  type: 'http'
  username?: string
  password?: string
  path?: string
  headers?: Record<string, string>
}

export interface AnyTLSProxy extends BaseProxy {
  type: 'anytls'
  password: string
  username?: string
  'idle-session-check-interval'?: number
  'idle-session-timeout'?: number
  'min-idle-session'?: number
  'client-metadata'?: string
  'disable-reuse'?: boolean
  insecure?: boolean
}

export interface SnellProxy extends BaseProxy {
  type: 'snell'
  psk: string
  userkey?: string
  version?: number
  reuse?: boolean
  mode?: string
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

export interface WireGuardPeer {
  server?: string
  port?: number
  'public-key'?: string
  'pre-shared-key'?: string
  reserved?: number[]
  'allowed-ips'?: string[]
}

export interface WireGuardProxy extends BaseProxy {
  type: 'wireguard'
  ip?: string
  ipv6?: string
  'private-key': string
  'public-key'?: string
  'remote-pubkey'?: string
  'pre-shared-key'?: string
  reserved?: number[]
  'allowed-ips'?: string[]
  mtu?: number
  workers?: number
  'persistent-keepalive'?: number
  'remote-dns-resolve'?: boolean
  dns?: string[]
  peers?: WireGuardPeer[]
  'amnezia-wg-option'?: Record<string, unknown>
}

export interface SshProxy extends BaseProxy {
  type: 'ssh'
  username: string
  password?: string
  'private-key'?: string
  'private-key-passphrase'?: string
  'host-key'?: string[]
  'host-key-algorithms'?: string[]
  'client-version'?: string
}

export interface MieruProxy extends BaseProxy {
  type: 'mieru'
  'port-range'?: string
  transport: string
  username: string
  password: string
  multiplexing?: string
  'handshake-mode'?: string
  'traffic-pattern'?: string
}

export interface NaiveProxy extends BaseProxy {
  type: 'naive'
  username?: string
  password?: string
  'insecure-concurrency'?: number
  headers?: Record<string, string>
  quic?: boolean
  'quic-congestion-control'?: string
  'udp-over-tcp'?: boolean
  padding?: boolean
}

export interface ShadowTlsProxy extends BaseProxy {
  type: 'shadowtls'
  version?: number
  password?: string
}

export interface SudokuProxy extends BaseProxy {
  type: 'sudoku'
  key: string
  'aead-method'?: string
  'padding-min'?: number
  'padding-max'?: number
  'table-type'?: string
  'enable-pure-downlink'?: boolean
  'http-mask'?: boolean
  'http-mask-mode'?: string
  'http-mask-tls'?: boolean
  'http-mask-host'?: string
  'path-root'?: string
  multiplex?: string
  'http-mask-multiplex'?: string
  httpmask?: {
    disable?: boolean
    mode?: string
    tls?: boolean
    host?: string
    'path-root'?: string
    multiplex?: string
  }
  'custom-table'?: string
  'custom-tables'?: string[]
}

export type Proxy =
  | SSProxy
  | SSRProxy
  | VmessProxy
  | TrojanProxy
  | VlessProxy
  | HysteriaProxy
  | Hysteria2Proxy
  | TuicProxy
  | SocksProxy
  | HttpProxy
  | AnyTLSProxy
  | SnellProxy
  | WireGuardProxy
  | SshProxy
  | MieruProxy
  | NaiveProxy
  | ShadowTlsProxy
  | SudokuProxy

export interface SingboxTlsConfig {
  enabled: boolean
  server_name?: string
  disable_sni?: boolean
  insecure?: boolean
  alpn?: string[]
  utls?: { enabled: boolean; fingerprint: string }
  certificate?: string | string[]
  certificate_public_key_sha256?: string[]
  certificate_sha256?: string[]
  ech?: {
    enabled: boolean
    config?: string[]
    config_path?: string
    query_server_name?: string
  }
  reality?: { enabled: boolean; public_key: string; short_id: string }
  [key: string]: unknown
}

export interface SingboxTransportConfig {
  type: string
  host?: string | string[]
  path?: string
  method?: string
  headers?: Record<string, string | string[]>
  max_early_data?: number
  early_data_header_name?: string
  service_name?: string
  idle_timeout?: string
  ping_timeout?: string
  permit_without_stream?: boolean
}

export interface SingboxMultiplexConfig {
  enabled: boolean
  protocol?: string
  max_connections?: number
  min_streams?: number
  max_streams?: number
  padding?: boolean
  brutal?: {
    enabled: boolean
    up_mbps?: number
    down_mbps?: number
  }
}

export interface SingboxOutbound {
  type: string
  tag: string
  server?: string
  server_port?: number
  password?: string
  uuid?: string
  tls?: SingboxTlsConfig
  transport?: SingboxTransportConfig
  multiplex?: SingboxMultiplexConfig
  detour?: string
  [key: string]: unknown
}

export interface SingboxEndpoint {
  type: string
  tag: string
  [key: string]: unknown
}

export interface SingboxConversionBundle {
  outbound?: SingboxOutbound
  endpoint?: SingboxEndpoint
  extraOutbounds?: SingboxOutbound[]
}

export interface ProtocolCodec<T extends Proxy = Proxy> {
  readonly types: ReadonlyArray<T['type']>
  readonly prefixes: readonly string[]
  parse(uri: string): T
  validate(proxy: Proxy): boolean
  toUri?(proxy: T): string | null
  toClashProxy?(proxy: T): Record<string, unknown> | null
  toSingboxOutbound(proxy: T): SingboxOutbound | null
  toSingboxBundle?(proxy: T): SingboxConversionBundle | null
}
