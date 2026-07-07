import { Proxy } from '@/node/types'
import { SingboxProxyConfig, SingboxTLSConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'

export function parse(uri: string): Proxy {
  const url = new URL(uri)
  const params = url.searchParams

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const allowInsecure = params.get('skip-cert-verify') === 'true'
    || params.get('allowInsecure') === '1'
    || params.get('insecure') === '1'

  const proxy: Proxy = {
    type: 'anytls',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    password: decodeURIComponent(url.username),
    sni: params.get('sni') || server,
    udp: params.get('udp') === 'false' ? false : true,
    'skip-cert-verify': allowInsecure,
    insecure: allowInsecure,
  }

  // 会话管理（秒 → number）
  const idleCheckInterval = params.get('idle-session-check-interval')
  if (idleCheckInterval) {
    proxy['idle-session-check-interval'] = parseInt(idleCheckInterval, 10)
  }

  const idleTimeout = params.get('idle-session-timeout')
  if (idleTimeout) {
    proxy['idle-session-timeout'] = parseInt(idleTimeout, 10)
  }

  const minIdleSession = params.get('min-idle-session')
  if (minIdleSession) {
    proxy['min-idle-session'] = parseInt(minIdleSession, 10)
  }

  // TLS 扩展
  const alpn = params.get('alpn')
  if (alpn) {
    proxy.alpn = alpn.split(',')
  }

  const clientFingerprint = params.get('client-fingerprint') || params.get('fp')
  if (clientFingerprint) {
    proxy['client-fingerprint'] = clientFingerprint
  }

  const fingerprint = params.get('fingerprint')
  if (fingerprint) {
    proxy.fingerprint = fingerprint
  }

  const certificate = params.get('certificate')
  if (certificate) {
    proxy.certificate = decodeURIComponent(certificate)
  }

  const privateKey = params.get('private-key')
  if (privateKey) {
    proxy['private-key'] = decodeURIComponent(privateKey)
  }

  // TCP Fast Open
  const tfo = params.get('tfo')
  if (tfo === '1' || tfo === 'true') {
    proxy.tfo = true
  }

  // ECH
  const echEnable = params.get('ech')
  if (echEnable === '1' || echEnable === 'true') {
    proxy['ech-opts'] = {
      enable: true,
      config: params.get('ech-config') || undefined,
      'query-server-name': params.get('ech-query-server-name') || undefined,
    }
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

  const tls: SingboxTLSConfig = {
    enabled: true,
    server_name: proxy.sni || proxy.server,
    insecure: proxy['skip-cert-verify'] ?? false,
  }

  if (proxy.alpn) {
    tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn]
  }
  if (proxy['client-fingerprint']) {
    tls.utls = { enabled: true, fingerprint: proxy['client-fingerprint'] }
  }
  if (proxy.fingerprint) {
    tls.fingerprint = proxy.fingerprint
  }
  if (proxy.certificate) {
    tls.certificate = proxy.certificate
  }
  if (proxy['ech-opts']) {
    tls.ech = {
      enabled: proxy['ech-opts'].enable ?? true,
      ...(proxy['ech-opts'].config && { config: proxy['ech-opts'].config }),
      ...(proxy['ech-opts']['query-server-name'] && { config_path: proxy['ech-opts']['query-server-name'] }),
    }
  }

  const config: SingboxProxyConfig = {
    type: 'anytls',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls,
  }

  if (proxy['idle-session-check-interval']) {
    config.idle_session_check_interval = proxy['idle-session-check-interval']
  }
  if (proxy['idle-session-timeout']) {
    config.idle_session_timeout = proxy['idle-session-timeout']
  }
  if (proxy['min-idle-session']) {
    config.min_idle_session = proxy['min-idle-session']
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
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy['idle-session-check-interval']) params.set('idle-session-check-interval', String(proxy['idle-session-check-interval']))
  if (proxy['idle-session-timeout']) params.set('idle-session-timeout', String(proxy['idle-session-timeout']))
  if (proxy['min-idle-session']) params.set('min-idle-session', String(proxy['min-idle-session']))
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy['client-fingerprint']) params.set('client-fingerprint', proxy['client-fingerprint'])
  if (proxy.fingerprint) params.set('fingerprint', proxy.fingerprint)
  if (proxy.certificate) params.set('certificate', proxy.certificate)
  if (proxy['private-key']) params.set('private-key', proxy['private-key'])
  if (proxy.tfo) params.set('tfo', '1')
  if (proxy['ech-opts']?.enable) {
    params.set('ech', '1')
    if (proxy['ech-opts'].config) params.set('ech-config', proxy['ech-opts'].config)
    if (proxy['ech-opts']['query-server-name']) params.set('ech-query-server-name', proxy['ech-opts']['query-server-name'])
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  const name = encodeURIComponent(proxy.name)
  const host = proxy.server.includes(':') ? `[${proxy.server}]` : proxy.server
  return `anytls://${encodeURIComponent(proxy.password || '')}@${host}:${proxy.port}${query}#${name}`
}

// ponytail: 兼容性导出
export const parseAnyTLS = parse
