import {
  appendEchParams,
  buildSingboxTls,
  extractFragmentName,
  formatHostForUri,
  formatSingboxDuration,
  normalizeAlpnList,
  normalizeBandwidthLabel,
  normalizeSingboxServerPorts,
  parseBandwidthMbps,
  parseBoolFlag,
  parseEchParams,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  HysteriaProxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseHysteriaUri(uri: string): HysteriaProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const up = normalizeBandwidthLabel(
    params.get('up') || params.get('upmbps') || params.get('up_mbps'),
  )
  const down = normalizeBandwidthLabel(
    params.get('down') || params.get('downmbps') || params.get('down_mbps'),
  )
  const authStr = params.get('auth') || params.get('auth_str') || params.get('auth-str') || ''
  const obfs = params.get('obfsParam') || params.get('obfs') || ''
  const protocol = params.get('protocol') || 'udp'
  const sni = params.get('peer') || params.get('sni') || ''
  const alpn = params.get('alpn')
  const ports = params.get('mport') || params.get('ports')
  const skipCertVerify =
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const fastOpen = parseBoolFlag(params.get('fastopen')) || parseBoolFlag(params.get('fast-open'))
  const hopInterval = params.get('hop-interval') || params.get('hop_interval')
  const echOpts = parseEchParams(params)

  return {
    type: 'hysteria',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    protocol,
    ...(authStr ? { 'auth-str': authStr } : {}),
    ...(up ? { up } : { up: '50 Mbps' }),
    ...(down ? { down } : { down: '100 Mbps' }),
    ...(obfs && obfs !== 'none' ? { obfs } : {}),
    ...(sni ? { sni } : {}),
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
    'skip-cert-verify': skipCertVerify,
    ...(ports ? { ports } : {}),
    ...(fastOpen ? { 'fast-open': true } : {}),
    ...(hopInterval ? { 'hop-interval': parseInt(hopInterval, 10) || hopInterval } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
  }
}

export function validateHysteriaProxy(proxy: Proxy): boolean {
  return proxy.type === 'hysteria' && Boolean(proxy.server && proxy.port)
}

export function hysteriaToUri(proxy: HysteriaProxy): string {
  const params = new URLSearchParams()
  const authStr = proxy['auth-str'] || proxy.auth_str || proxy.auth
  if (authStr) params.set('auth', authStr)
  if (proxy.protocol) params.set('protocol', proxy.protocol)
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('peer', sni)
  if (proxy['skip-cert-verify'] || proxy.insecure) params.set('insecure', '1')
  const upMbps = parseBandwidthMbps(proxy.up_mbps ?? proxy['up-speed'] ?? proxy.up)
  const downMbps = parseBandwidthMbps(proxy.down_mbps ?? proxy['down-speed'] ?? proxy.down)
  if (upMbps) params.set('upmbps', String(upMbps))
  if (downMbps) params.set('downmbps', String(downMbps))
  if (proxy.obfs) params.set('obfsParam', proxy.obfs)
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy.ports || proxy.mport) params.set('mport', proxy.ports || proxy.mport || '')
  if (proxy['fast-open']) params.set('fastopen', '1')
  appendEchParams(params, proxy['ech-opts'])

  const query = params.toString() ? `?${params.toString()}` : ''
  return `hysteria://${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function hysteriaToClashProxy(proxy: HysteriaProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned['auth-str'] && typeof cleaned.auth_str === 'string') {
    cleaned['auth-str'] = cleaned.auth_str
  }
  delete cleaned.auth_str
  if (!cleaned.up) {
    cleaned.up = normalizeBandwidthLabel(proxy.up_mbps ?? proxy['up-speed']) || '50 Mbps'
  }
  if (!cleaned.down) {
    cleaned.down = normalizeBandwidthLabel(proxy.down_mbps ?? proxy['down-speed']) || '100 Mbps'
  }
  if (!cleaned.ports && typeof cleaned.mport === 'string') cleaned.ports = cleaned.mport
  delete cleaned.mport
  return cleaned
}

export function hysteriaToSingboxOutbound(proxy: HysteriaProxy): SingboxOutbound {
  const upMbps = parseBandwidthMbps(proxy.up_mbps ?? proxy['up-speed'] ?? proxy.up) || 50
  const downMbps = parseBandwidthMbps(proxy.down_mbps ?? proxy['down-speed'] ?? proxy.down) || 100
  const serverPorts = normalizeSingboxServerPorts(proxy.ports || proxy.mport)
  const hopInterval = formatSingboxDuration(proxy['hop-interval'])
  const authStr = proxy['auth-str'] || proxy.auth_str
  const tls = buildSingboxTls(proxy, { forceEnabled: true, allowUtls: false })

  return {
    type: 'hysteria',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    ...(serverPorts ? { server_ports: serverPorts } : {}),
    ...(hopInterval ? { hop_interval: hopInterval } : {}),
    up_mbps: upMbps,
    down_mbps: downMbps,
    ...(proxy.obfs ? { obfs: proxy.obfs } : {}),
    ...(authStr ? { auth_str: authStr } : proxy.auth ? { auth: proxy.auth } : {}),
    tls,
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const hysteriaCodec: ProtocolCodec<HysteriaProxy> = {
  types: ['hysteria'],
  prefixes: ['hysteria://'],
  parse: parseHysteriaUri,
  validate: validateHysteriaProxy,
  toUri: hysteriaToUri,
  toClashProxy: hysteriaToClashProxy,
  toSingboxOutbound: hysteriaToSingboxOutbound,
}
