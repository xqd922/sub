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
  'encrypt-method'?: string  
  password?: string
  uuid?: string
  alterId?: number
  network?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  tls?: boolean
  'skip-cert-verify'?: boolean
  sni?: string

  obfs?: string
  'obfs-host'?: string

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

  insecure?: boolean
  up_mbps?: number
  down_mbps?: number
  up?: string | null
  down?: string | null
  'obfs-password'?: string

  reality?: boolean

  tfo?: boolean

  username?: string

  'idle-session-check-interval'?: number
  'idle-session-timeout'?: number
  'min-idle-session'?: number

  fingerprint?: string
  certificate?: string
  'private-key'?: string

  'ech-opts'?: {
    enable?: boolean
    config?: string
    'query-server-name'?: string
  }

  'dialer-proxy'?: string
  detour?: string
}

export interface DnsConfig {
  enable: boolean
  ipv6: boolean
  listen?: string
  'default-nameserver'?: string[]
  'enhanced-mode'?: string
  'fake-ip-range': string
  'use-hosts': boolean
  'respect-rules'?: boolean
  'proxy-server-nameserver'?: string[]
  nameserver: string[]
  fallback?: string[]
  'fake-ip-filter'?: string[]
  'cache-algorithm'?: string
  'nameserver-policy'?: Record<string, string | string[]>
  'direct-nameserver'?: string[]
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
  'unified-delay'?: boolean
  'tcp-concurrent'?: boolean
  'keep-alive-idle'?: number
  'keep-alive-interval'?: number
  'find-process-mode'?: string
  'external-controller'?: string
  'external-ui'?: string
  'external-ui-url'?: string
  secret?: string
  profile?: {
    'store-selected'?: boolean
    'store-fake-ip'?: boolean
  }
  dns?: DnsConfig
  proxies: Proxy[]
  'proxy-groups': ProxyGroup[]
  rules: string[]
  'rule-providers'?: Record<string, RuleProvider>
  'hosts'?: Record<string, string[]>
  sniffer?: {
    enable?: boolean
    sniff?: {
      TLS?: { ports?: (number | string)[], 'override-destination'?: boolean }
      HTTP?: { ports?: (number | string)[], 'override-destination'?: boolean }
      QUIC?: { ports?: (number | string)[], 'override-destination'?: boolean }
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

export interface RuleProvider {
  type: 'http' | 'file'
  behavior: 'domain' | 'ipcidr' | 'classical'
  format?: 'yaml' | 'text' | 'mrs'
  url?: string
  path: string
  interval?: number
}

export interface YamlSubscription {
  proxies?: Proxy[]
  [key: string]: unknown
}

export interface SingboxTLSConfig {
  enabled: boolean;
  server_name: string;
  insecure: boolean;
  alpn?: string[];
  utls?: { enabled: boolean; fingerprint: string };
  fingerprint?: string;
  certificate?: string;
  ech?: { enabled: boolean; config?: string; config_path?: string };
  [key: string]: unknown;
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
  detour?: string;  
  [key: string]: unknown;
} 