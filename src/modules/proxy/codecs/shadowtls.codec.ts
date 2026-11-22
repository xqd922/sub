import {
  buildSingboxTls,
  extractFragmentName,
  extractRawAuth,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  ShadowTlsProxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseShadowTlsUri(uri: string): ShadowTlsProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  const password = extractRawAuth(url) || params.get('password') || ''
  const versionRaw = params.get('version')
  const version = versionRaw && /^\d+$/.test(versionRaw) ? parseInt(versionRaw, 10) : 3
  const sni = params.get('sni') || params.get('host') || server
  const fp = params.get('fp') || params.get('client-fingerprint')
  const alpn = params.get('alpn')
  const skipCertVerify =
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))

  return {
    type: 'shadowtls',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    version,
    ...(password ? { password } : {}),
    sni,
    ...(skipCertVerify ? { 'skip-cert-verify': true } : {}),
    ...(fp ? { 'client-fingerprint': fp } : {}),
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
  }
}

export function validateShadowTlsProxy(proxy: Proxy): boolean {
  return proxy.type === 'shadowtls' && Boolean(proxy.server && proxy.port)
}

export function shadowTlsToUri(proxy: ShadowTlsProxy): string {
  const params = new URLSearchParams()
  if (proxy.version) params.set('version', String(proxy.version))
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('sni', sni)
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy['client-fingerprint']) params.set('fp', proxy['client-fingerprint'])
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  const auth = proxy.password ? `${encodeURIComponent(proxy.password)}@` : ''
  const query = params.toString() ? `?${params.toString()}` : ''
  return `shadowtls://${auth}${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function shadowTlsToSingboxOutbound(proxy: ShadowTlsProxy): SingboxOutbound {
  const tls = buildSingboxTls(proxy, { forceEnabled: true })
  return {
    type: 'shadowtls',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    version: proxy.version || 3,
    ...(proxy.password ? { password: proxy.password } : {}),
    tls,
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const shadowTlsCodec: ProtocolCodec<ShadowTlsProxy> = {
  types: ['shadowtls'],
  prefixes: ['shadowtls://'],
  parse: parseShadowTlsUri,
  validate: validateShadowTlsProxy,
  toUri: shadowTlsToUri,
  // Mihomo 不支持独立 type: shadowtls 节点（仅支持作为其他协议的前置 plugin / shadow-tls-opts）
  toClashProxy: () => null,
  toSingboxOutbound: shadowTlsToSingboxOutbound,
}
