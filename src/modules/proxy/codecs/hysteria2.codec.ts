import {
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  safeDecodeUriComponent,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  Hysteria2Proxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

function parseMbps(value?: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value !== 'string') return undefined
  const match = value.match(/(\d+)/)
  if (!match) return undefined
  const parsed = parseInt(match[1], 10)
  return parsed > 0 ? parsed : undefined
}

function normalizeBandwidthLabel(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return /^\d+$/.test(trimmed) ? `${trimmed} Mbps` : trimmed
}

function normalizeSingboxServerPorts(ports?: string): string[] | undefined {
  if (!ports) return undefined
  const list = ports
    .split(',')
    .map((part) => part.trim().replace(/-/g, ':'))
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}

export function parseHysteria2Uri(uri: string): Hysteria2Proxy {
  const normalized = uri.startsWith('hy2://') ? `hysteria2://${uri.slice(6)}` : uri
  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const upParam = normalizeBandwidthLabel(
    params.get('up') || params.get('upmbps') || params.get('up_mbps'),
  )
  const downParam = normalizeBandwidthLabel(
    params.get('down') || params.get('downmbps') || params.get('down_mbps'),
  )
  const obfs = params.get('obfs')
  const obfsPassword = params.get('obfs-password')
  const mport = params.get('mport') || params.get('ports')
  const insecure = params.get('insecure') || params.get('allowInsecure')

  return {
    type: 'hysteria2',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    password: safeDecodeUriComponent(url.username),
    sni: params.get('sni') || '',
    'skip-cert-verify': insecure === '1' || insecure === 'true',
    'client-fingerprint': params.get('fp') || params.get('fingerprint') || 'chrome',
    alpn: params.get('alpn')?.split(',') || ['h3'],
    up: upParam,
    down: downParam,
    obfs: obfs || undefined,
    'obfs-password': obfsPassword || undefined,
    ...(mport ? { ports: mport } : {}),
  }
}

export function validateHysteria2Proxy(proxy: Proxy): boolean {
  return proxy.type === 'hysteria2' && Boolean(proxy.password)
}

export function hysteria2ToUri(proxy: Hysteria2Proxy): string {
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify'] || proxy.insecure) params.set('insecure', '1')
  if (proxy.obfs) params.set('obfs', proxy.obfs)
  if (proxy['obfs-password']) params.set('obfs-password', proxy['obfs-password'])
  if (proxy.ports || proxy.mport) params.set('mport', proxy.ports || proxy.mport || '')
  if (proxy.up) params.set('up', proxy.up)
  if (proxy.down) params.set('down', proxy.down)
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)

  const query = params.toString() ? `?${params.toString()}` : ''
  return `hy2://${encodeURIComponent(proxy.password)}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function hysteria2ToSingboxOutbound(proxy: Hysteria2Proxy): SingboxOutbound {
  const alpn = normalizeAlpnList(proxy.alpn)
  const upMbps = parseMbps(proxy.up_mbps ?? proxy.up)
  const downMbps = parseMbps(proxy.down_mbps ?? proxy.down)
  const serverPorts = normalizeSingboxServerPorts(proxy.ports || proxy.mport)

  const outbound: SingboxOutbound = {
    type: 'hysteria2',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    ...(serverPorts ? { server_ports: serverPorts } : {}),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.servername || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? proxy.insecure ?? false,
      ...(alpn ? { alpn } : {}),
    },
    ...(upMbps ? { up_mbps: upMbps } : {}),
    ...(downMbps ? { down_mbps: downMbps } : {}),
  }

  if (proxy.obfs && proxy['obfs-password']) {
    outbound.obfs = {
      type: proxy.obfs,
      password: proxy['obfs-password'],
    }
  }

  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const hysteria2Codec: ProtocolCodec<Hysteria2Proxy> = {
  types: ['hysteria2'],
  prefixes: ['hysteria2://', 'hy2://'],
  parse: parseHysteria2Uri,
  validate: validateHysteria2Proxy,
  toUri: hysteria2ToUri,
  toSingboxOutbound: hysteria2ToSingboxOutbound,
}
