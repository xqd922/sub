import {
  appendEchParams,
  buildShadowTlsSingboxOutbound,
  buildSingboxTls,
  extractFragmentName,
  extractRawAuth,
  formatHostForUri,
  formatSingboxDuration,
  normalizeAlpnList,
  parseBoolFlag,
  parseEchParams,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  AnyTLSProxy,
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseAnyTlsUri(uri: string): AnyTLSProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const allowInsecure =
    parseBoolFlag(params.get('skip-cert-verify')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure'))

  const password = url.password ? safeDecodeUriComponent(url.password) : extractRawAuth(url)
  const echOpts = parseEchParams(params)

  const proxy: AnyTLSProxy = {
    type: 'anytls',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    password,
    sni: params.get('sni') || server,
    udp: params.get('udp') !== 'false',
    'skip-cert-verify': allowInsecure,
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
  }

  const idleCheckInterval = params.get('idle-session-check-interval')
  if (idleCheckInterval && /^\d+$/.test(idleCheckInterval)) {
    proxy['idle-session-check-interval'] = parseInt(idleCheckInterval, 10)
  }

  const idleTimeout = params.get('idle-session-timeout')
  if (idleTimeout && /^\d+$/.test(idleTimeout)) {
    proxy['idle-session-timeout'] = parseInt(idleTimeout, 10)
  }

  const minIdleSession = params.get('min-idle-session')
  if (minIdleSession && /^\d+$/.test(minIdleSession)) {
    proxy['min-idle-session'] = parseInt(minIdleSession, 10)
  }

  const clientMetadata = params.get('client-metadata') || params.get('client_metadata')
  if (clientMetadata) proxy['client-metadata'] = clientMetadata

  if (parseBoolFlag(params.get('disable-reuse'))) proxy['disable-reuse'] = true

  const alpn = params.get('alpn')
  if (alpn) proxy.alpn = normalizeAlpnList(alpn)

  const clientFingerprint = params.get('client-fingerprint') || params.get('fp')
  if (clientFingerprint) proxy['client-fingerprint'] = clientFingerprint

  const fingerprint = params.get('hpkp') || params.get('fingerprint')
  if (fingerprint) proxy.fingerprint = fingerprint

  const certificate = params.get('certificate')
  if (certificate) proxy.certificate = safeDecodeUriComponent(certificate)

  const privateKey = params.get('private-key')
  if (privateKey) proxy['private-key'] = safeDecodeUriComponent(privateKey)

  if (parseBoolFlag(params.get('tfo'))) proxy.tfo = true

  return proxy
}

export function validateAnyTlsProxy(proxy: Proxy): boolean {
  return proxy.type === 'anytls' && Boolean(proxy.password)
}

export function anyTlsToUri(proxy: AnyTLSProxy): string {
  const params = new URLSearchParams()
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('sni', sni)
  if (proxy['skip-cert-verify'] || proxy.insecure) params.set('insecure', '1')
  if (proxy['idle-session-check-interval']) {
    params.set('idle-session-check-interval', String(proxy['idle-session-check-interval']))
  }
  if (proxy['idle-session-timeout']) {
    params.set('idle-session-timeout', String(proxy['idle-session-timeout']))
  }
  if (proxy['min-idle-session']) {
    params.set('min-idle-session', String(proxy['min-idle-session']))
  }
  if (proxy['client-metadata']) params.set('client-metadata', proxy['client-metadata'])
  if (proxy['disable-reuse']) params.set('disable-reuse', '1')
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy['client-fingerprint']) params.set('fp', proxy['client-fingerprint'])
  if (proxy.fingerprint) params.set('hpkp', proxy.fingerprint)
  if (proxy.certificate) params.set('certificate', proxy.certificate)
  if (proxy['private-key']) params.set('private-key', proxy['private-key'])
  if (proxy.tfo) params.set('tfo', '1')
  appendEchParams(params, proxy['ech-opts'])

  const query = params.toString() ? `?${params.toString()}` : ''
  return `anytls://${encodeURIComponent(proxy.password || '')}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function anyTlsToClashProxy(proxy: AnyTLSProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.sni && typeof cleaned.servername === 'string' && cleaned.servername) {
    cleaned.sni = cleaned.servername
  }
  delete cleaned.servername
  return cleaned
}

export function anyTlsToSingboxBundle(proxy: AnyTLSProxy): SingboxConversionBundle {
  const tls = buildSingboxTls(proxy, { forceEnabled: true })
  const checkInterval = formatSingboxDuration(proxy['idle-session-check-interval'])
  const idleTimeout = formatSingboxDuration(proxy['idle-session-timeout'])

  const outbound: SingboxOutbound = {
    type: 'anytls',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    password: proxy.password || '',
    tls,
    ...(checkInterval ? { idle_session_check_interval: checkInterval } : {}),
    ...(idleTimeout ? { idle_session_timeout: idleTimeout } : {}),
    ...(proxy['min-idle-session'] ? { min_idle_session: proxy['min-idle-session'] } : {}),
    ...(proxy['client-metadata'] ? { client_metadata: proxy['client-metadata'] } : {}),
    ...(proxy.tfo ? { tcp_fast_open: true } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }

  const stls = proxy['shadow-tls-opts']
  if (stls?.password) {
    const stlsTag = `${proxy.name}-shadowtls`
    const stlsOutbound = buildShadowTlsSingboxOutbound(proxy, stls, stlsTag)
    outbound.detour = stlsTag
    delete outbound.server
    delete outbound.server_port
    return { outbound, extraOutbounds: [stlsOutbound] }
  }

  return { outbound }
}

export function anyTlsToSingboxOutbound(proxy: AnyTLSProxy): SingboxOutbound {
  return anyTlsToSingboxBundle(proxy).outbound!
}

export const anyTlsCodec: ProtocolCodec<AnyTLSProxy> = {
  types: ['anytls'],
  prefixes: ['anytls://'],
  parse: parseAnyTlsUri,
  validate: validateAnyTlsProxy,
  toUri: anyTlsToUri,
  toClashProxy: anyTlsToClashProxy,
  toSingboxOutbound: anyTlsToSingboxOutbound,
  toSingboxBundle: anyTlsToSingboxBundle,
}
