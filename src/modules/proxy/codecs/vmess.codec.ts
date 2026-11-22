import {
  appendEchParams,
  buildShadowTlsSingboxOutbound,
  buildSingboxMultiplex,
  buildSingboxTls,
  buildSingboxV2RayTransport,
  extractFragmentName,
  normalizeAlpnList,
  parseBoolFlag,
  parseEchParams,
  parseWsEarlyData,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  SingboxOutbound,
  VmessProxy,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8, encodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

interface RawVmessConfig {
  ps?: string
  add?: string
  port?: string | number
  id?: string
  aid?: string | number
  scy?: string
  net?: string
  type?: string
  tls?: string
  sni?: string
  host?: string
  path?: string
  alpn?: string
  fp?: string
  allowInsecure?: boolean | number | string
  insecure?: boolean | number | string
}

function parseXrayAeadVmessUri(uri: string): VmessProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  if (!server) throw new Error('VMess 链接缺少服务器地址')

  const security = (params.get('security') || 'none').toLowerCase()
  const tlsEnabled = security === 'tls' || security === 'reality' || security.endsWith('tls')
  const rawNet = (params.get('type') || 'tcp').toLowerCase()
  const headerType = (params.get('headerType') || '').toLowerCase()
  let network = rawNet
  if (rawNet === 'tcp' && headerType === 'http') network = 'http'
  else if (rawNet === 'http') network = 'h2'

  const host = params.get('host') || ''
  const fp = params.get('fp') || params.get('client-fingerprint')
  const alpn = params.get('alpn')
  const pbk = params.get('pbk')
  const sid = params.get('sid')
  const echOpts = parseEchParams(params)
  const skipCertVerify =
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))

  const proxy: VmessProxy = {
    type: 'vmess',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    uuid: safeDecodeUriComponent(url.username),
    alterId: 0,
    cipher: params.get('encryption') || 'auto',
    network,
    udp: params.get('udp') !== 'false',
    tls: tlsEnabled,
    'skip-cert-verify': skipCertVerify,
    servername: params.get('sni') || '',
    tfo: parseBoolFlag(params.get('tfo')),
    ...(fp ? { 'client-fingerprint': fp } : {}),
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
    ...(pbk ? { 'reality-opts': { 'public-key': pbk, 'short-id': sid || '' } } : {}),
  }

  if (network === 'ws' || network === 'httpupgrade') {
    const ed = parseWsEarlyData(params.get('path'), params.get('ed'), params.get('eh'))
    proxy['ws-opts'] = {
      path: ed.path,
      headers: { Host: host || server },
      ...(network === 'httpupgrade' ? { 'v2ray-http-upgrade': true } : {}),
      ...(ed.maxEarlyData !== undefined && network === 'ws'
        ? {
            'max-early-data': ed.maxEarlyData,
            'early-data-header-name': ed.earlyDataHeaderName || 'Sec-WebSocket-Protocol',
          }
        : {}),
      ...(ed.maxEarlyData !== undefined && network === 'httpupgrade'
        ? { 'v2ray-http-upgrade-fast-open': true }
        : {}),
    }
  } else if (network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || params.get('path') || '',
      ...(params.get('mode') ? { 'grpc-mode': params.get('mode')! } : {}),
    }
  } else if (network === 'http') {
    proxy['http-opts'] = {
      path: [params.get('path') || '/'],
      ...(host ? { headers: { Host: host.split(',').map((h) => h.trim()).filter(Boolean) } } : {}),
    }
  } else if (network === 'h2') {
    proxy['h2-opts'] = {
      path: params.get('path') || '/',
      ...(host ? { host: host.split(',').map((h) => h.trim()).filter(Boolean) } : {}),
    }
  }

  return proxy
}

export function parseVmessUri(uri: string): VmessProxy {
  const content = uri.slice(8).trim()
  if (!content) throw new Error('VMess 链接为空')

  let config: RawVmessConfig | null = null
  if (!content.includes('@')) {
    config = JSON.parse(decodeBase64Utf8(content)) as RawVmessConfig
  } else {
    try {
      const decoded = decodeBase64Utf8(content)
      if (decoded.trim().startsWith('{')) {
        config = JSON.parse(decoded) as RawVmessConfig
      }
    } catch {
      // 按 Xray VMessAEAD URL 格式解析
    }
  }

  if (!config) {
    return parseXrayAeadVmessUri(uri)
  }

  const server = stripIpv6Brackets(config.add || '')
  const rawNet = (config.net || 'tcp').toLowerCase()
  const rawType = (config.type || '').toLowerCase()
  let network = rawNet
  if (rawNet === 'tcp' && rawType === 'http') {
    network = 'http'
  } else if (rawNet === 'http') {
    network = 'h2'
  }

  const skipCertVerify =
    config.allowInsecure === true ||
    config.allowInsecure === 1 ||
    config.allowInsecure === '1' ||
    config.insecure === true ||
    config.insecure === 1 ||
    config.insecure === '1'

  const proxy: VmessProxy = {
    type: 'vmess',
    name: config.ps || server,
    server,
    port: parsePort(config.port),
    uuid: config.id || '',
    alterId: parseInt(String(config.aid), 10) || 0,
    cipher: config.scy || 'auto',
    network,
    udp: true,
    tls: config.tls === 'tls' || config.tls === 'xtls',
    'skip-cert-verify': skipCertVerify,
    servername: config.sni || '',
    tfo: false,
    ...(config.fp ? { 'client-fingerprint': config.fp } : {}),
    ...(config.alpn ? { alpn: normalizeAlpnList(config.alpn) } : {}),
  }

  if (network === 'ws' || network === 'httpupgrade') {
    const ed = parseWsEarlyData(config.path)
    proxy['ws-opts'] = {
      path: ed.path,
      headers: {
        Host: config.host || server,
      },
      ...(network === 'httpupgrade' ? { 'v2ray-http-upgrade': true } : {}),
      ...(ed.maxEarlyData !== undefined && network === 'ws'
        ? {
            'max-early-data': ed.maxEarlyData,
            'early-data-header-name': ed.earlyDataHeaderName || 'Sec-WebSocket-Protocol',
          }
        : {}),
      ...(ed.maxEarlyData !== undefined && network === 'httpupgrade'
        ? { 'v2ray-http-upgrade-fast-open': true }
        : {}),
    }
  } else if (network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': config.path || '',
      ...(config.type && config.type !== 'none' ? { 'grpc-mode': config.type } : {}),
    }
  } else if (network === 'http') {
    proxy['http-opts'] = {
      path: [config.path || '/'],
      ...(config.host
        ? { headers: { Host: config.host.split(',').map((h) => h.trim()).filter(Boolean) } }
        : {}),
    }
  } else if (network === 'h2') {
    proxy['h2-opts'] = {
      path: config.path || '/',
      ...(config.host
        ? { host: config.host.split(',').map((h) => h.trim()).filter(Boolean) }
        : {}),
    }
  }

  return proxy
}

export function validateVmessProxy(proxy: unknown): proxy is VmessProxy {
  return (
    typeof proxy === 'object' &&
    proxy !== null &&
    'type' in proxy &&
    proxy.type === 'vmess' &&
    'uuid' in proxy &&
    typeof proxy.uuid === 'string' &&
    proxy.uuid.length > 0
  )
}

export function vmessToUri(proxy: VmessProxy): string {
  const isGrpc = proxy.network === 'grpc'
  const isHttpUpgrade =
    proxy.network === 'httpupgrade' ||
    (proxy.network === 'ws' && Boolean(proxy['ws-opts']?.['v2ray-http-upgrade']))
  const isHttpFake = proxy.network === 'http'
  const isH2 = proxy.network === 'h2'

  let net = proxy.network || 'tcp'
  let headerType = 'none'
  let host = proxy['ws-opts']?.headers?.Host || proxy.wsHeaders?.Host || ''
  let path = proxy['ws-opts']?.path || proxy.wsPath || ''

  if (isGrpc) {
    headerType = proxy['grpc-opts']?.['grpc-mode'] || 'gun'
    path = proxy['grpc-opts']?.['grpc-service-name'] || ''
  } else if (isHttpUpgrade) {
    net = 'httpupgrade'
  } else if (isHttpFake) {
    net = 'tcp'
    headerType = 'http'
    host = proxy['http-opts']?.headers?.Host?.join(',') || ''
    path = proxy['http-opts']?.path?.[0] || '/'
  } else if (isH2) {
    net = 'h2'
    host = proxy['h2-opts']?.host?.join(',') || ''
    path = proxy['h2-opts']?.path || '/'
  }

  if ((net === 'ws' || net === 'httpupgrade') && proxy['ws-opts']?.['max-early-data']) {
    const sep = path.includes('?') ? '&' : '?'
    path = `${path}${sep}ed=${proxy['ws-opts']['max-early-data']}`
  }

  const echParams = new URLSearchParams()
  appendEchParams(echParams, proxy['ech-opts'])

  const config = {
    v: '2',
    ps: proxy.name,
    add: proxy.server,
    port: String(proxy.port),
    id: proxy.uuid,
    aid: String(proxy.alterId || 0),
    scy: proxy.cipher || 'auto',
    net,
    type: headerType,
    tls: proxy.tls ? 'tls' : '',
    sni: proxy.servername || proxy.sni || '',
    host,
    path,
    ...(proxy['client-fingerprint'] ? { fp: proxy['client-fingerprint'] } : {}),
    ...(proxy.alpn ? { alpn: Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn } : {}),
    ...(proxy['skip-cert-verify'] ? { allowInsecure: 1 } : {}),
  }

  return `vmess://${encodeBase64Utf8(JSON.stringify(config))}`
}

export function vmessToClashProxy(proxy: VmessProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.servername && typeof cleaned.sni === 'string' && cleaned.sni) {
    cleaned.servername = cleaned.sni
  }
  delete cleaned.sni
  if (!cleaned.servername) delete cleaned.servername
  if (cleaned.alterId === undefined) cleaned.alterId = 0
  if (!cleaned.cipher) cleaned.cipher = 'auto'
  return cleaned
}

export function vmessToSingboxBundle(proxy: VmessProxy): SingboxConversionBundle | null {
  const transportResult = buildSingboxV2RayTransport(proxy)
  if (!transportResult.supported) {
    return null
  }

  const tls = buildSingboxTls(proxy)
  const multiplex = buildSingboxMultiplex(proxy.smux)
  const packetEncoding =
    proxy['packet-encoding'] ||
    (proxy['packet-addr'] ? 'packetaddr' : proxy.xudp ? 'xudp' : undefined)

  const outbound: SingboxOutbound = {
    type: 'vmess',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    security: proxy.cipher || 'auto',
    alter_id: proxy.alterId || 0,
    ...(proxy['global-padding'] ? { global_padding: true } : {}),
    ...(proxy['authenticated-length'] ? { authenticated_length: true } : {}),
    ...(packetEncoding && packetEncoding !== 'none' ? { packet_encoding: packetEncoding } : {}),
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

export function vmessToSingboxOutbound(proxy: VmessProxy): SingboxOutbound | null {
  return vmessToSingboxBundle(proxy)?.outbound ?? null
}

export const vmessCodec: ProtocolCodec<VmessProxy> = {
  types: ['vmess'],
  prefixes: ['vmess://'],
  parse: parseVmessUri,
  validate: (proxy: Proxy) => validateVmessProxy(proxy),
  toUri: vmessToUri,
  toClashProxy: vmessToClashProxy,
  toSingboxOutbound: vmessToSingboxOutbound,
  toSingboxBundle: vmessToSingboxBundle,
}
