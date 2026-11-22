import type { Proxy } from '@/modules/proxy/proxy.types'

export type ClientType = 'clash' | 'singbox' | 'v2rayng' | 'browser'

export interface ClashDnsConfig {
  enable: boolean
  ipv6: boolean
  listen?: string
  'default-nameserver'?: string[]
  'enhanced-mode'?: string
  'fake-ip-range': string
  'fake-ip-range6'?: string
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

export interface ProxyGroup {
  name: string
  type: string
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
  lazy?: boolean
  hidden?: boolean
}

export interface RuleProvider {
  type: 'http' | 'file'
  behavior: 'domain' | 'ipcidr' | 'classical'
  format?: 'yaml' | 'text' | 'mrs'
  url?: string
  path: string
  interval?: number
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
  dns?: ClashDnsConfig
  proxies: Proxy[]
  'proxy-groups': ProxyGroup[]
  rules: string[]
  'rule-providers'?: Record<string, RuleProvider>
  hosts?: Record<string, string | string[]>
  sniffer?: {
    enable?: boolean
    sniff?: {
      TLS?: { ports?: (number | string)[]; 'override-destination'?: boolean }
      HTTP?: { ports?: (number | string)[]; 'override-destination'?: boolean }
      QUIC?: { ports?: (number | string)[]; 'override-destination'?: boolean }
    }
    'skip-domain'?: string[]
    'parse-pure-ip'?: boolean
    'force-dns-mapping'?: boolean
    'override-destination'?: boolean
  }
}

export interface YamlSubscription {
  proxies?: Proxy[]
  [key: string]: unknown
}
