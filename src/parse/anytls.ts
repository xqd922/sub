import { Proxy, SingboxProxyConfig } from '@/types'
import { parsePort } from '@/utils'

export function parse(uri: string): Proxy {
  const url = new URL(uri)
  const params = url.searchParams

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const proxy: Proxy = {
    type: 'anytls',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    password: decodeURIComponent(url.username),
    sni: params.get('sni') || url.hostname,
    udp: true,
    'skip-cert-verify': params.get('skip-cert-verify') === 'true' || params.get('allowInsecure') === '1'
  }

  const idleCheckInterval = params.get('idle-session-check-interval')
  if (idleCheckInterval) {
    proxy['idle-session-check-interval'] = idleCheckInterval
  }

  const idleTimeout = params.get('idle-session-timeout')
  if (idleTimeout) {
    proxy['idle-session-timeout'] = idleTimeout
  }

  return proxy
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'anytls' && !!(proxy.password)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'anytls') {
    return null
  }

  const config: SingboxProxyConfig = {
    type: 'anytls',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false
    }
  }

  if (proxy['idle-session-check-interval']) {
    config.idle_session_check_interval = proxy['idle-session-check-interval']
  }
  if (proxy['idle-session-timeout']) {
    config.idle_session_timeout = proxy['idle-session-timeout']
  }

  if (proxy.detour) {
    config.detour = proxy.detour
  }

  return config
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'anytls') return null

  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('skip-cert-verify', 'true')
  if (proxy['idle-session-check-interval']) params.set('idle-session-check-interval', proxy['idle-session-check-interval'])
  if (proxy['idle-session-timeout']) params.set('idle-session-timeout', proxy['idle-session-timeout'])

  const query = params.toString() ? `?${params.toString()}` : ''
  const name = encodeURIComponent(proxy.name)
  return `anytls://${encodeURIComponent(proxy.password || '')}@${proxy.server}:${proxy.port}${query}#${name}`
}

// ponytail: 兼容性导出
export const parseAnyTLS = parse