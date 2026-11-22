import {
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  safeDecodeUriComponent,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  AnyTLSProxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  SingboxTlsConfig,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseAnyTlsUri(uri: string): AnyTLSProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const allowInsecure =
    params.get('skip-cert-verify') === 'true' ||
    params.get('allowInsecure') === '1' ||
    params.get('insecure') === '1'

  const proxy: AnyTLSProxy = {
    type: 'anytls',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    password: safeDecodeUriComponent(url.username),
    sni: params.get('sni') || server,
    udp: params.get('udp') === 'false' ? false : true,
    'skip-cert-verify': allowInsecure,
    insecure: allowInsecure,
  }

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

  const alpn = params.get('alpn')
  if (alpn) proxy.alpn = alpn.split(',')

  const clientFingerprint = params.get('client-fingerprint') || params.get('fp')
  if (clientFingerprint) proxy['client-fingerprint'] = clientFingerprint

  const fingerprint = params.get('fingerprint')
  if (fingerprint) proxy.fingerprint = fingerprint

  const certificate = params.get('certificate')
  if (certificate) proxy.certificate = safeDecodeUriComponent(certificate)

  const privateKey = params.get('private-key')
  if (privateKey) proxy['private-key'] = safeDecodeUriComponent(privateKey)

  const tfo = params.get('tfo')
  if (tfo === '1' || tfo === 'true') proxy.tfo = true

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

export function validateAnyTlsProxy(proxy: Proxy): boolean {
  return proxy.type === 'anytls' && Boolean(proxy.password)
}

export function anyTlsToUri(proxy: AnyTLSProxy): string {
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy['idle-session-check-interval']) {
    params.set('idle-session-check-interval', String(proxy['idle-session-check-interval']))
  }
  if (proxy['idle-session-timeout']) {
    params.set('idle-session-timeout', String(proxy['idle-session-timeout']))
  }
  if (proxy['min-idle-session']) {
    params.set('min-idle-session', String(proxy['min-idle-session']))
  }
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy['client-fingerprint']) params.set('client-fingerprint', proxy['client-fingerprint'])
  if (proxy.fingerprint) params.set('fingerprint', proxy.fingerprint)
  if (proxy.certificate) params.set('certificate', proxy.certificate)
  if (proxy['private-key']) params.set('private-key', proxy['private-key'])
  if (proxy.tfo) params.set('tfo', '1')
  if (proxy['ech-opts']?.enable) {
    params.set('ech', '1')
    if (proxy['ech-opts'].config) params.set('ech-config', proxy['ech-opts'].config)
    if (proxy['ech-opts']['query-server-name']) {
      params.set('ech-query-server-name', proxy['ech-opts']['query-server-name'])
    }
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  return `anytls://${encodeURIComponent(proxy.password || '')}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function anyTlsToSingboxOutbound(proxy: AnyTLSProxy): SingboxOutbound {
  const alpn = normalizeAlpnList(proxy.alpn)
  const tls: SingboxTlsConfig = {
    enabled: true,
    server_name: proxy.sni || proxy.server,
    insecure: proxy['skip-cert-verify'] ?? false,
    ...(alpn ? { alpn } : {}),
    ...(proxy['client-fingerprint']
      ? { utls: { enabled: true, fingerprint: proxy['client-fingerprint'] } }
      : {}),
    ...(proxy.fingerprint ? { fingerprint: proxy.fingerprint } : {}),
    ...(proxy.certificate ? { certificate: proxy.certificate } : {}),
    ...(proxy['ech-opts']
      ? {
          ech: {
            enabled: proxy['ech-opts'].enable ?? true,
            ...(proxy['ech-opts'].config ? { config: proxy['ech-opts'].config } : {}),
            ...(proxy['ech-opts']['query-server-name']
              ? { config_path: proxy['ech-opts']['query-server-name'] }
              : {}),
          },
        }
      : {}),
  }

  const outbound: SingboxOutbound = {
    type: 'anytls',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls,
  }

  if (proxy['idle-session-check-interval']) {
    outbound.idle_session_check_interval = `${proxy['idle-session-check-interval']}s`
  }
  if (proxy['idle-session-timeout']) {
    outbound.idle_session_timeout = `${proxy['idle-session-timeout']}s`
  }
  if (proxy['min-idle-session']) {
    outbound.min_idle_session = proxy['min-idle-session']
  }
  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const anyTlsCodec: ProtocolCodec<AnyTLSProxy> = {
  types: ['anytls'],
  prefixes: ['anytls://'],
  parse: parseAnyTlsUri,
  validate: validateAnyTlsProxy,
  toUri: anyTlsToUri,
  toSingboxOutbound: anyTlsToSingboxOutbound,
}
