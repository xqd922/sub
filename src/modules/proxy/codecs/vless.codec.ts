import {
  appendEchParams,
  buildShadowTlsSingboxOutbound,
  buildSingboxMultiplex,
  buildSingboxTls,
  buildSingboxV2RayTransport,
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  parseEchParams,
  parseWsEarlyData,
  parseXhttpExtra,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  SingboxOutbound,
  VlessProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseVlessUri(uri: string): VlessProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const host = params.get('host') || ''
  const flow = params.get('flow') || ''
  const encryption = params.get('encryption') || ''
  const security = (params.get('security') || 'none').toLowerCase()
  const tlsEnabled = security === 'tls' || security === 'reality' || security.endsWith('tls')
  const fp = params.get('fp') || params.get('client-fingerprint') || (tlsEnabled ? 'chrome' : '')
  const rawType = (params.get('type') || 'tcp').toLowerCase()
  const headerType = (params.get('headerType') || '').toLowerCase()
  let network = rawType
  if (rawType === 'tcp' && headerType === 'http') {
    network = 'http'
  } else if (rawType === 'http') {
    network = 'h2'
  } else if (rawType === 'splithttp') {
    network = 'xhttp'
  }

  const pbk = params.get('pbk')
  const sid = params.get('sid')
  const spx = params.get('spx')
  const sni = params.get('sni') || ''
  const alpn = params.get('alpn')
  const pcs = params.get('pcs') || params.get('fingerprint')
  const echOpts = parseEchParams(params)
  const skipCertVerify =
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const packetEncoding = params.get('packetEncoding') || params.get('packet-encoding') || ''
  const tfo = parseBoolFlag(params.get('tfo'))

  const proxy: VlessProxy = {
    type: 'vless',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    uuid: safeDecodeUriComponent(url.username),
    udp: params.get('udp') !== 'false',
    tls: tlsEnabled,
    ...(flow ? { flow } : {}),
    ...(encryption && encryption !== 'none' ? { encryption } : {}),
    servername: sni,
    'skip-cert-verify': skipCertVerify,
    ...(fp ? { 'client-fingerprint': fp } : {}),
    ...(pcs ? { fingerprint: pcs } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
    network,
    tfo,
    ...(alpn ? { alpn: normalizeAlpnList(alpn) } : {}),
    ...(packetEncoding && packetEncoding !== 'none'
      ? { 'packet-encoding': packetEncoding === 'packet' ? 'packetaddr' : packetEncoding }
      : {}),
  }

  if (pbk) {
    const mlkem = params.get('support-x25519mlkem768')
    proxy['reality-opts'] = {
      'public-key': pbk,
      'short-id': sid || '',
      ...(spx ? { 'spider-x': spx } : {}),
      ...(mlkem !== null ? { 'support-x25519mlkem768': parseBoolFlag(mlkem) } : {}),
    }
  }

  if (network === 'ws' || network === 'httpupgrade') {
    const ed = parseWsEarlyData(params.get('path'), params.get('ed'), params.get('eh'))
    proxy['ws-opts'] = {
      path: ed.path,
      headers: {
        Host: host || server,
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
      'grpc-service-name': params.get('serviceName') || params.get('path') || '',
      ...(params.get('mode') ? { 'grpc-mode': params.get('mode')! } : {}),
    }
  } else if (network === 'http') {
    proxy['http-opts'] = {
      ...(params.get('method') ? { method: params.get('method')! } : {}),
      path: [params.get('path') || '/'],
      ...(host ? { headers: { Host: host.split(',').map((h) => h.trim()).filter(Boolean) } } : {}),
    }
  } else if (network === 'h2') {
    proxy['h2-opts'] = {
      path: params.get('path') || '/',
      ...(host ? { host: host.split(',').map((h) => h.trim()).filter(Boolean) } : {}),
    }
  } else if (network === 'xhttp') {
    const extraRaw = params.get('extra')
    const extraOpts = extraRaw ? parseXhttpExtra(extraRaw) : {}
    proxy['xhttp-opts'] = {
      ...(params.get('path') ? { path: params.get('path')! } : {}),
      ...(host ? { host } : {}),
      ...(params.get('mode') ? { mode: params.get('mode')! } : {}),
      ...extraOpts,
    }
  }

  return proxy
}

export function validateVlessProxy(proxy: Proxy): boolean {
  return proxy.type === 'vless' && Boolean(proxy.uuid)
}

export function vlessToUri(proxy: VlessProxy): string {
  const params = new URLSearchParams()
  const isHttpUpgrade =
    proxy.network === 'httpupgrade' ||
    (proxy.network === 'ws' && Boolean(proxy['ws-opts']?.['v2ray-http-upgrade']))

  if (proxy.network === 'http') {
    params.set('type', 'tcp')
    params.set('headerType', 'http')
  } else if (proxy.network === 'h2') {
    params.set('type', 'http')
  } else {
    params.set('type', isHttpUpgrade ? 'httpupgrade' : proxy.network || 'tcp')
  }

  params.set('security', proxy['reality-opts']?.['public-key'] ? 'reality' : proxy.tls ? 'tls' : 'none')
  params.set('encryption', proxy.encryption || 'none')

  const sni = proxy.servername || proxy.sni
  if (sni) params.set('sni', sni)
  if (proxy.flow) params.set('flow', proxy.flow)
  if (proxy['client-fingerprint'] || proxy.fp) {
    params.set('fp', proxy['client-fingerprint'] || proxy.fp || '')
  }
  if (proxy.fingerprint) params.set('pcs', proxy.fingerprint)
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy['packet-encoding']) params.set('packetEncoding', proxy['packet-encoding'])
  appendEchParams(params, proxy['ech-opts'])

  if (proxy['reality-opts']?.['public-key']) {
    params.set('pbk', proxy['reality-opts']['public-key'])
    if (proxy['reality-opts']['short-id']) params.set('sid', proxy['reality-opts']['short-id'])
    if (proxy['reality-opts']['spider-x']) params.set('spx', proxy['reality-opts']['spider-x'])
    if (proxy['reality-opts']['support-x25519mlkem768'] !== undefined) {
      params.set('support-x25519mlkem768', String(proxy['reality-opts']['support-x25519mlkem768']))
    }
  }

  if ((proxy.network === 'ws' || isHttpUpgrade) && proxy['ws-opts']) {
    if (proxy['ws-opts'].path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts'].headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
    if (proxy['ws-opts']['max-early-data']) {
      params.set('ed', String(proxy['ws-opts']['max-early-data']))
    }
    if (proxy['ws-opts']['early-data-header-name']) {
      params.set('eh', proxy['ws-opts']['early-data-header-name'])
    }
  } else if (proxy.network === 'grpc' && proxy['grpc-opts']) {
    if (proxy['grpc-opts']['grpc-service-name']) {
      params.set('serviceName', proxy['grpc-opts']['grpc-service-name'])
    }
    if (proxy['grpc-opts']['grpc-mode']) {
      params.set('mode', proxy['grpc-opts']['grpc-mode'])
    }
  } else if (proxy.network === 'http' && proxy['http-opts']) {
    if (proxy['http-opts'].path?.[0]) params.set('path', proxy['http-opts'].path[0])
    if (proxy['http-opts'].headers?.Host?.[0]) params.set('host', proxy['http-opts'].headers.Host.join(','))
    if (proxy['http-opts'].method) params.set('method', proxy['http-opts'].method)
  } else if (proxy.network === 'h2' && proxy['h2-opts']) {
    if (proxy['h2-opts'].path) params.set('path', proxy['h2-opts'].path)
    if (proxy['h2-opts'].host?.length) params.set('host', proxy['h2-opts'].host.join(','))
  } else if (proxy.network === 'xhttp' && proxy['xhttp-opts']) {
    if (proxy['xhttp-opts'].path) params.set('path', proxy['xhttp-opts'].path)
    if (proxy['xhttp-opts'].host) params.set('host', proxy['xhttp-opts'].host)
    if (proxy['xhttp-opts'].mode) params.set('mode', proxy['xhttp-opts'].mode)
    if (proxy['xhttp-opts']._rawExtra) params.set('extra', proxy['xhttp-opts']._rawExtra)
  }

  return `vless://${encodeURIComponent(proxy.uuid)}@${formatHostForUri(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`
}

export function vlessToClashProxy(proxy: VlessProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.servername && typeof cleaned.sni === 'string' && cleaned.sni) {
    cleaned.servername = cleaned.sni
  }
  delete cleaned.sni
  if (!cleaned.servername) delete cleaned.servername
  return cleaned
}

export function vlessToSingboxBundle(proxy: VlessProxy): SingboxConversionBundle | null {
  // sing-box 暂不支持 VLESS 非 none 加密（如 PQ mlkem）及 xhttp/kcp 传输层
  if (proxy.encryption && proxy.encryption !== 'none') {
    return null
  }

  const transportResult = buildSingboxV2RayTransport(proxy)
  if (!transportResult.supported) {
    return null
  }

  const packetEncoding =
    proxy['packet-encoding'] ||
    (proxy['packet-addr'] ? 'packetaddr' : 'xudp')

  const tls = buildSingboxTls(proxy)
  const multiplex = buildSingboxMultiplex(proxy.smux)
  const outbound: SingboxOutbound = {
    type: 'vless',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    ...(proxy.flow ? { flow: proxy.flow } : {}),
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

export function vlessToSingboxOutbound(proxy: VlessProxy): SingboxOutbound | null {
  return vlessToSingboxBundle(proxy)?.outbound ?? null
}

export const vlessCodec: ProtocolCodec<VlessProxy> = {
  types: ['vless'],
  prefixes: ['vless://'],
  parse: parseVlessUri,
  validate: validateVlessProxy,
  toUri: vlessToUri,
  toClashProxy: vlessToClashProxy,
  toSingboxOutbound: vlessToSingboxOutbound,
  toSingboxBundle: vlessToSingboxBundle,
}
