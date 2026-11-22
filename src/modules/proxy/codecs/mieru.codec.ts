import {
  extractFragmentName,
  formatHostForUri,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  MieruProxy,
  ProtocolCodec,
  Proxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseMieruUri(uri: string): MieruProxy {
  const normalized = uri.toLowerCase().startsWith('mierus://')
    ? `mieru://${uri.slice(9)}`
    : uri
  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  if (!server) throw new Error('Mieru 链接缺少服务器地址')

  const username = safeDecodeUriComponent(url.username)
  const password = safeDecodeUriComponent(url.password)
  const rawPort = params.get('port') || url.port || ''
  const rawPortRange = params.get('port-range') || (rawPort.includes('-') ? rawPort : '')
  const firstPort = rawPortRange ? rawPortRange.split('-')[0] : rawPort
  const transport = (params.get('protocol') || params.get('transport') || 'TCP').toUpperCase()
  const multiplexing = params.get('multiplexing') || undefined
  const handshakeMode = params.get('handshake-mode') || undefined
  const trafficPattern = params.get('traffic-pattern') || undefined
  const fallbackName = params.get('profile') || server

  return {
    type: 'mieru',
    name: extractFragmentName(url, fallbackName),
    server,
    port: parsePort(firstPort, 443),
    ...(rawPortRange ? { 'port-range': rawPortRange } : {}),
    transport,
    udp: true,
    username,
    password,
    ...(multiplexing ? { multiplexing } : {}),
    ...(handshakeMode ? { 'handshake-mode': handshakeMode } : {}),
    ...(trafficPattern ? { 'traffic-pattern': trafficPattern } : {}),
  }
}

export function validateMieruProxy(proxy: Proxy): boolean {
  return proxy.type === 'mieru' && Boolean(proxy.username && proxy.password && proxy.transport)
}

export function mieruToUri(proxy: MieruProxy): string {
  const params = new URLSearchParams()
  params.set('port', proxy['port-range'] || String(proxy.port))
  params.set('protocol', (proxy.transport || 'TCP').toUpperCase())
  if (proxy.multiplexing) params.set('multiplexing', proxy.multiplexing)
  if (proxy['handshake-mode']) params.set('handshake-mode', proxy['handshake-mode'])
  if (proxy['traffic-pattern']) params.set('traffic-pattern', proxy['traffic-pattern'])

  const auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}`
  return `mierus://${auth}@${formatHostForUri(proxy.server)}?${params.toString()}#${encodeURIComponent(proxy.name)}`
}

export function mieruToClashProxy(proxy: MieruProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  // Mihomo Mieru 配置 port-range 与 port 二选一
  if (cleaned['port-range']) {
    delete cleaned.port
  }
  return cleaned
}

export const mieruCodec: ProtocolCodec<MieruProxy> = {
  types: ['mieru'],
  prefixes: ['mieru://', 'mierus://'],
  parse: parseMieruUri,
  validate: validateMieruProxy,
  toUri: mieruToUri,
  toClashProxy: mieruToClashProxy,
  // sing-box 暂不支持 Mieru 出站
  toSingboxOutbound: () => null,
}
