import {
  appendEchParams,
  buildSingboxTls,
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  parseEchParams,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  TuicProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseTuicUri(uri: string): TuicProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const username = safeDecodeUriComponent(url.username)
  const hasPassword = url.password !== ''
  const password = safeDecodeUriComponent(url.password)

  const cc = params.get('congestion_control') || params.get('congestion-controller') || params.get('cc')
  const udpRelayMode = params.get('udp_relay_mode') || params.get('udp-relay-mode')
  const alpn = params.get('alpn')
  const sni = params.get('sni') || ''
  const disableSni = parseBoolFlag(params.get('disable_sni')) || parseBoolFlag(params.get('disable-sni'))
  const skipCertVerify =
    parseBoolFlag(params.get('allow_insecure')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const reduceRtt =
    parseBoolFlag(params.get('reduce_rtt')) ||
    parseBoolFlag(params.get('reduce-rtt')) ||
    parseBoolFlag(params.get('zero_rtt_handshake'))
  const udpOverStream =
    parseBoolFlag(params.get('udp_over_stream')) || parseBoolFlag(params.get('udp-over-stream'))
  const heartbeatRaw = params.get('heartbeat_interval') || params.get('heartbeat-interval') || params.get('heartbeat')
  const heartbeatMs = heartbeatRaw
    ? heartbeatRaw.endsWith('s') && !heartbeatRaw.endsWith('ms')
      ? Math.round(parseFloat(heartbeatRaw) * 1000)
      : parseInt(heartbeatRaw, 10)
    : undefined
  const fastOpen = parseBoolFlag(params.get('fast_open')) || parseBoolFlag(params.get('fast-open'))
  const bbrProfile = params.get('bbr_profile') || params.get('bbr-profile')
  const fingerprint = params.get('pcs') || params.get('fingerprint')
  const echOpts = parseEchParams(params)

  return {
    type: 'tuic',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    udp: true,
    ...(hasPassword ? { uuid: username, password } : { token: username }),
    ...(sni ? { sni } : {}),
    ...(disableSni ? { 'disable-sni': true } : {}),
    ...(skipCertVerify ? { 'skip-cert-verify': true } : {}),
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
    ...(cc ? { 'congestion-controller': cc } : {}),
    ...(udpRelayMode ? { 'udp-relay-mode': udpRelayMode } : {}),
    ...(reduceRtt ? { 'reduce-rtt': true } : {}),
    ...(udpOverStream ? { 'udp-over-stream': true } : {}),
    ...(heartbeatMs && Number.isFinite(heartbeatMs) && heartbeatMs > 0
      ? { 'heartbeat-interval': heartbeatMs }
      : {}),
    ...(fastOpen ? { 'fast-open': true } : {}),
    ...(bbrProfile ? { 'bbr-profile': bbrProfile } : {}),
    ...(fingerprint ? { fingerprint } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
  }
}

export function validateTuicProxy(proxy: Proxy): boolean {
  if (proxy.type !== 'tuic') return false
  return Boolean((proxy.uuid && proxy.password) || proxy.token)
}

export function tuicToUri(proxy: TuicProxy): string {
  const params = new URLSearchParams()
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('sni', sni)
  if (proxy['disable-sni']) params.set('disable_sni', '1')
  if (proxy['skip-cert-verify']) params.set('allow_insecure', '1')
  if (proxy['congestion-controller']) params.set('congestion_control', proxy['congestion-controller'])
  if (proxy['udp-relay-mode']) params.set('udp_relay_mode', proxy['udp-relay-mode'])
  if (proxy['reduce-rtt']) params.set('reduce_rtt', '1')
  if (proxy['udp-over-stream']) params.set('udp_over_stream', '1')
  if (proxy['heartbeat-interval']) params.set('heartbeat_interval', String(proxy['heartbeat-interval']))
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy.fingerprint) params.set('pcs', proxy.fingerprint)
  appendEchParams(params, proxy['ech-opts'])

  const auth =
    proxy.uuid && proxy.password !== undefined
      ? `${encodeURIComponent(proxy.uuid)}:${encodeURIComponent(proxy.password)}`
      : encodeURIComponent(proxy.token || proxy.uuid || '')
  const query = params.toString() ? `?${params.toString()}` : ''
  return `tuic://${auth}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function tuicToClashProxy(proxy: TuicProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.sni && typeof cleaned.servername === 'string' && cleaned.servername) {
    cleaned.sni = cleaned.servername
  }
  delete cleaned.servername
  return cleaned
}

export function tuicToSingboxOutbound(proxy: TuicProxy): SingboxOutbound | null {
  // sing-box 仅支持 TUIC v5（需要 uuid + password），TUIC v4 token 节点安全跳过
  if (!proxy.uuid) {
    return null
  }

  const tls = buildSingboxTls(proxy, { forceEnabled: true, allowUtls: false })
  const heartbeat =
    proxy['heartbeat-interval'] && proxy['heartbeat-interval'] > 0
      ? `${Math.max(1, Math.round(proxy['heartbeat-interval'] / 1000))}s`
      : undefined

  return {
    type: 'tuic',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    uuid: proxy.uuid,
    password: proxy.password || '',
    ...(proxy['congestion-controller'] ? { congestion_control: proxy['congestion-controller'] } : {}),
    ...(proxy['udp-relay-mode'] ? { udp_relay_mode: proxy['udp-relay-mode'] } : {}),
    ...(proxy['udp-over-stream'] ? { udp_over_stream: true } : {}),
    ...(proxy['reduce-rtt'] ? { zero_rtt_handshake: true } : {}),
    ...(heartbeat ? { heartbeat } : {}),
    ...(proxy.udp === false ? { network: 'tcp' } : {}),
    tls,
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const tuicCodec: ProtocolCodec<TuicProxy> = {
  types: ['tuic'],
  prefixes: ['tuic://'],
  parse: parseTuicUri,
  validate: validateTuicProxy,
  toUri: tuicToUri,
  toClashProxy: tuicToClashProxy,
  toSingboxOutbound: tuicToSingboxOutbound,
}
