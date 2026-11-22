import {
  appendEchParams,
  buildShadowTlsSingboxOutbound,
  buildSingboxMultiplex,
  buildSingboxTls,
  buildSingboxV2RayTransport,
  extractFragmentName,
  extractRawAuth,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  parseEchParams,
  parseWsEarlyData,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  SingboxOutbound,
  TrojanProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseTrojanUri(uri: string): TrojanProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const skipCertVerify =
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const fp = params.get('fp') || params.get('client-fingerprint')
  const alpn = params.get('alpn')
  const pcs = params.get('pcs') || params.get('fingerprint')
  const pbk = params.get('pbk')
  const sid = params.get('sid')
  const echOpts = parseEchParams(params)
  const security = (params.get('security') || 'tls').toLowerCase()

  const proxy: TrojanProxy = {
    type: 'trojan',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    password: extractRawAuth(url),
    udp: params.get('udp') !== 'false',
    sni: params.get('sni') || params.get('peer') || server,
    'skip-cert-verify': skipCertVerify,
    ...(security === 'none' ? { tls: false } : {}),
    ...(fp ? { 'client-fingerprint': fp } : {}),
    ...(pcs ? { fingerprint: pcs } : {}),
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
    ...(pbk ? { 'reality-opts': { 'public-key': pbk, 'short-id': sid || '' } } : {}),
    ...(parseBoolFlag(params.get('tfo')) ? { tfo: true } : {}),
  }

  const transportType = (params.get('type') || '').toLowerCase()
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || params.get('path') || '',
      ...(params.get('mode') ? { 'grpc-mode': params.get('mode')! } : {}),
    }
  } else if (transportType === 'ws' || transportType === 'httpupgrade') {
    const ed = parseWsEarlyData(params.get('path') || '/', params.get('ed'), params.get('eh'))
    proxy.network = transportType
    proxy['ws-opts'] = {
      path: ed.path || '/',
      headers: params.get('host') ? { Host: params.get('host')! } : {},
      ...(transportType === 'httpupgrade' ? { 'v2ray-http-upgrade': true } : {}),
      ...(ed.maxEarlyData !== undefined && transportType === 'ws'
        ? {
            'max-early-data': ed.maxEarlyData,
            'early-data-header-name': ed.earlyDataHeaderName || 'Sec-WebSocket-Protocol',
          }
        : {}),
      ...(ed.maxEarlyData !== undefined && transportType === 'httpupgrade'
        ? { 'v2ray-http-upgrade-fast-open': true }
        : {}),
    }
  }

  return proxy
}

export function validateTrojanProxy(proxy: Proxy): boolean {
  return proxy.type === 'trojan' && Boolean(proxy.password)
}

export function trojanToUri(proxy: TrojanProxy): string {
  const params = new URLSearchParams()
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('sni', sni)
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy['client-fingerprint'] || proxy.fp) {
    params.set('fp', proxy['client-fingerprint'] || proxy.fp || '')
  }
  if (proxy.fingerprint) params.set('pcs', proxy.fingerprint)
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  appendEchParams(params, proxy['ech-opts'])

  if (proxy['reality-opts']?.['public-key']) {
    params.set('security', 'reality')
    params.set('pbk', proxy['reality-opts']['public-key'])
    if (proxy['reality-opts']['short-id']) params.set('sid', proxy['reality-opts']['short-id'])
  }

  const isHttpUpgrade =
    proxy.network === 'httpupgrade' ||
    (proxy.network === 'ws' && Boolean(proxy['ws-opts']?.['v2ray-http-upgrade']))

  if (proxy.network === 'ws' || isHttpUpgrade) {
    params.set('type', isHttpUpgrade ? 'httpupgrade' : 'ws')
    if (proxy['ws-opts']?.path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts']?.headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
    if (proxy['ws-opts']?.['max-early-data']) {
      params.set('ed', String(proxy['ws-opts']['max-early-data']))
    }
  } else if (proxy.network === 'grpc') {
    params.set('type', 'grpc')
    if (proxy['grpc-opts']?.['grpc-service-name']) {
      params.set('serviceName', proxy['grpc-opts']['grpc-service-name'])
    }
    if (proxy['grpc-opts']?.['grpc-mode']) {
      params.set('mode', proxy['grpc-opts']['grpc-mode'])
    }
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  return `trojan://${encodeURIComponent(proxy.password)}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function trojanToClashProxy(proxy: TrojanProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.sni && typeof cleaned.servername === 'string' && cleaned.servername) {
    cleaned.sni = cleaned.servername
  }
  delete cleaned.servername
  return cleaned
}

export function trojanToSingboxBundle(proxy: TrojanProxy): SingboxConversionBundle | null {
  const transportResult = buildSingboxV2RayTransport(proxy)
  if (!transportResult.supported) {
    return null
  }

  const tls = buildSingboxTls(proxy, { forceEnabled: proxy.tls !== false })
  const multiplex = buildSingboxMultiplex(proxy.smux)

  const outbound: SingboxOutbound = {
    type: 'trojan',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    ...(proxy.udp === false ? { network: 'tcp' } : {}),
    ...(proxy.tfo ? { tcp_fast_open: true } : {}),
    ...(tls ? { tls } : {}),
    ...(transportResult.transport ? { transport: transportResult.transport } : {}),
    ...(multiplex ? { multiplex } : {}),
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

export function trojanToSingboxOutbound(proxy: TrojanProxy): SingboxOutbound | null {
  return trojanToSingboxBundle(proxy)?.outbound ?? null
}

export const trojanCodec: ProtocolCodec<TrojanProxy> = {
  types: ['trojan'],
  prefixes: ['trojan://'],
  parse: parseTrojanUri,
  validate: validateTrojanProxy,
  toUri: trojanToUri,
  toClashProxy: trojanToClashProxy,
  toSingboxOutbound: trojanToSingboxOutbound,
  toSingboxBundle: trojanToSingboxBundle,
}
