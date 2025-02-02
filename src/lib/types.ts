export type ConfigType = 'basic' | 'custom' | 'microsoft' | 'google' | 'full'

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
}

export interface ClashConfig {
  port: number
  'socks-port': number
  'allow-lan': boolean
  mode: string
  'log-level': string
  proxies: Proxy[]
  'proxy-groups': ProxyGroup[]
  rules: string[]
}

export interface ProxyGroup {
  name: string
  type: string
  proxies: string[]
} 