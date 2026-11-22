import {
  buildSingboxTls,
  cleanStringHeaders,
  extractFragmentName,
  formatHostForUri,
  parseBoolFlag,
  safeDecodeUriComponent,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  NaiveProxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseNaiveUri(uri: string): NaiveProxy {
  const lower = uri.toLowerCase()
  const isQuic = lower.startsWith('naive+quic://')
  const normalized = `https://${uri.slice(uri.indexOf('://') + 3)}`
  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const username = safeDecodeUriComponent(url.username)
  const password = safeDecodeUriComponent(url.password)
  const sni = params.get('sni') || undefined
  const insecureConcurrency = params.get('insecure-concurrency') || params.get('insecure_concurrency')
  const quicCC = params.get('quic-congestion-control') || params.get('quic_congestion_control')
  const skipCertVerify =
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const uot = parseBoolFlag(params.get('uot')) || parseBoolFlag(params.get('udp-over-tcp'))

  return {
    type: 'naive',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(sni ? { sni } : {}),
    ...(skipCertVerify ? { 'skip-cert-verify': true } : {}),
    ...(isQuic || parseBoolFlag(params.get('quic')) ? { quic: true } : {}),
    ...(quicCC ? { 'quic-congestion-control': quicCC } : {}),
    ...(insecureConcurrency && /^\d+$/.test(insecureConcurrency)
      ? { 'insecure-concurrency': parseInt(insecureConcurrency, 10) }
      : {}),
    ...(uot ? { 'udp-over-tcp': true } : {}),
    ...(params.has('padding') ? { padding: parseBoolFlag(params.get('padding')) } : {}),
  }
}

export function validateNaiveProxy(proxy: Proxy): boolean {
  return proxy.type === 'naive' && Boolean(proxy.server && proxy.port)
}

export function naiveToUri(proxy: NaiveProxy): string {
  const scheme = proxy.quic ? 'naive+quic' : 'naive+https'
  const auth =
    proxy.username || proxy.password
      ? `${encodeURIComponent(proxy.username || '')}:${encodeURIComponent(proxy.password || '')}@`
      : ''
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy['insecure-concurrency']) {
    params.set('insecure-concurrency', String(proxy['insecure-concurrency']))
  }
  if (proxy['quic-congestion-control']) {
    params.set('quic-congestion-control', proxy['quic-congestion-control'])
  }
  if (proxy['udp-over-tcp']) params.set('uot', '1')
  if (proxy.padding !== undefined) params.set('padding', proxy.padding ? 'true' : 'false')
  const query = params.toString() ? `?${params.toString()}` : ''
  return `${scheme}://${auth}${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function naiveToSingboxOutbound(proxy: NaiveProxy): SingboxOutbound {
  const tls = buildSingboxTls(proxy, { forceEnabled: true, allowUtls: false })
  const headers = cleanStringHeaders(proxy.headers)

  return {
    type: 'naive',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    ...(proxy.username ? { username: proxy.username } : {}),
    ...(proxy.password ? { password: proxy.password } : {}),
    ...(proxy['insecure-concurrency'] ? { insecure_concurrency: proxy['insecure-concurrency'] } : {}),
    ...(Object.keys(headers).length > 0 ? { extra_headers: headers } : {}),
    ...(proxy.quic ? { quic: true } : {}),
    ...(proxy['quic-congestion-control']
      ? { quic_congestion_control: proxy['quic-congestion-control'] }
      : {}),
    ...(proxy['udp-over-tcp'] ? { udp_over_tcp: { enabled: true } } : {}),
    tls,
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const naiveCodec: ProtocolCodec<NaiveProxy> = {
  types: ['naive'],
  prefixes: ['naive+https://', 'naive+quic://'],
  parse: parseNaiveUri,
  validate: validateNaiveProxy,
  toUri: naiveToUri,
  // Mihomo 暂不支持 NaiveProxy 出站
  toClashProxy: () => null,
  toSingboxOutbound: naiveToSingboxOutbound,
}
