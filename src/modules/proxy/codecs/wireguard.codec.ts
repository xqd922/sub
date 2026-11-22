import {
  extractFragmentName,
  formatHostForUri,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  WireGuardProxy,
} from '@/modules/proxy/proxy.types'
import { base64ToBytes } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

function parseReserved(raw: string | null): number[] | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
        return parsed
      }
    } catch {
      // fallback
    }
  }

  if (/^\d+(,\s*\d+)+$/.test(trimmed)) {
    return trimmed.split(',').map((item) => parseInt(item.trim(), 10))
  }

  try {
    const bytes = base64ToBytes(trimmed)
    if (bytes.length === 3) {
      return Array.from(bytes)
    }
  } catch {
    // ignore
  }
  return undefined
}

function ensureCidr(ip: string): string {
  const trimmed = ip.trim()
  if (trimmed.includes('/')) return trimmed
  return trimmed.includes(':') ? `${trimmed}/128` : `${trimmed}/32`
}

function stripCidr(ip: string): string {
  return ip.trim().split('/')[0] || ip.trim()
}

export function parseWireGuardUri(uri: string): WireGuardProxy {
  const normalized = uri.toLowerCase().startsWith('wg://')
    ? `wireguard://${uri.slice(5)}`
    : uri
  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  const privateKey = safeDecodeUriComponent(url.username) || params.get('privatekey') || params.get('private-key') || ''
  const publicKey =
    params.get('publickey') ||
    params.get('public-key') ||
    params.get('remote-pubkey') ||
    params.get('peer-public-key') ||
    ''
  const preSharedKey = params.get('presharedkey') || params.get('pre-shared-key') || params.get('psk') || ''

  const addresses = (params.get('address') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  let ip = params.get('ip') || ''
  let ipv6 = params.get('ipv6') || ''
  for (const addr of addresses) {
    if (addr.includes(':')) {
      if (!ipv6) ipv6 = addr
    } else if (!ip) {
      ip = addr
    }
  }

  const mtuRaw = params.get('mtu')
  const keepaliveRaw = params.get('keepalive') || params.get('persistent-keepalive')
  const reserved = parseReserved(params.get('reserved'))
  const dns = params
    .get('dns')
    ?.split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  const allowedIps = params
    .get('allowed-ips')
    ?.split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  return {
    type: 'wireguard',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 51820),
    'private-key': privateKey,
    ...(publicKey ? { 'public-key': publicKey } : {}),
    ...(preSharedKey ? { 'pre-shared-key': preSharedKey } : {}),
    ...(ip ? { ip } : {}),
    ...(ipv6 ? { ipv6 } : {}),
    ...(reserved ? { reserved } : {}),
    ...(allowedIps?.length ? { 'allowed-ips': allowedIps } : {}),
    ...(mtuRaw && /^\d+$/.test(mtuRaw) ? { mtu: parseInt(mtuRaw, 10) } : {}),
    ...(keepaliveRaw && /^\d+$/.test(keepaliveRaw)
      ? { 'persistent-keepalive': parseInt(keepaliveRaw, 10) }
      : {}),
    ...(dns?.length ? { dns } : {}),
    udp: true,
  }
}

export function validateWireGuardProxy(proxy: Proxy): boolean {
  if (proxy.type !== 'wireguard') return false
  const hasPubKey = Boolean(
    proxy['public-key'] || proxy['remote-pubkey'] || proxy.peers?.[0]?.['public-key'],
  )
  return Boolean(proxy['private-key'] && hasPubKey)
}

export function wireGuardToUri(proxy: WireGuardProxy): string {
  const params = new URLSearchParams()
  const firstPeer = proxy.peers?.[0]
  const pubKey = proxy['public-key'] || proxy['remote-pubkey'] || firstPeer?.['public-key']
  const psk = proxy['pre-shared-key'] || firstPeer?.['pre-shared-key']
  const reserved = proxy.reserved || firstPeer?.reserved

  if (pubKey) params.set('publickey', pubKey)
  if (psk) params.set('presharedkey', psk)
  const addrs = [proxy.ip, proxy.ipv6].filter(Boolean) as string[]
  if (addrs.length > 0) params.set('address', addrs.join(','))
  if (reserved?.length) params.set('reserved', reserved.join(','))
  if (proxy.mtu) params.set('mtu', String(proxy.mtu))
  if (proxy['persistent-keepalive']) params.set('keepalive', String(proxy['persistent-keepalive']))
  if (proxy.dns?.length) params.set('dns', proxy.dns.join(','))

  const server = firstPeer?.server || proxy.server
  const port = firstPeer?.port || proxy.port || 51820
  const query = params.toString() ? `?${params.toString()}` : ''
  return `wireguard://${encodeURIComponent(proxy['private-key'])}@${formatHostForUri(server)}:${port}${query}#${encodeURIComponent(proxy.name)}`
}

export function wireGuardToClashProxy(proxy: WireGuardProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned['public-key'] && typeof cleaned['remote-pubkey'] === 'string') {
    cleaned['public-key'] = cleaned['remote-pubkey']
  }
  delete cleaned['remote-pubkey']
  if (typeof cleaned.ip === 'string') cleaned.ip = stripCidr(cleaned.ip)
  if (typeof cleaned.ipv6 === 'string') cleaned.ipv6 = stripCidr(cleaned.ipv6)
  return cleaned
}

export function wireGuardToSingboxBundle(proxy: WireGuardProxy): SingboxConversionBundle | null {
  const addresses: string[] = []
  if (proxy.ip) addresses.push(ensureCidr(proxy.ip))
  if (proxy.ipv6) addresses.push(ensureCidr(proxy.ipv6))
  if (addresses.length === 0) {
    // sing-box WireGuard endpoint 要求 address 非空
    return null
  }

  const peers =
    proxy.peers && proxy.peers.length > 0
      ? proxy.peers.map((peer) => ({
          address: peer.server || proxy.server,
          port: parsePort(peer.port ?? proxy.port, 51820),
          public_key: peer['public-key'] || proxy['public-key'] || proxy['remote-pubkey'] || '',
          ...(peer['pre-shared-key'] ? { pre_shared_key: peer['pre-shared-key'] } : {}),
          allowed_ips: peer['allowed-ips']?.length ? peer['allowed-ips'] : ['0.0.0.0/0', '::/0'],
          ...(peer.reserved?.length ? { reserved: peer.reserved } : {}),
          ...(proxy['persistent-keepalive']
            ? { persistent_keepalive_interval: proxy['persistent-keepalive'] }
            : {}),
        }))
      : [
          {
            address: proxy.server,
            port: parsePort(proxy.port, 51820),
            public_key: proxy['public-key'] || proxy['remote-pubkey'] || '',
            ...(proxy['pre-shared-key'] ? { pre_shared_key: proxy['pre-shared-key'] } : {}),
            allowed_ips: proxy['allowed-ips']?.length
              ? proxy['allowed-ips']
              : ['0.0.0.0/0', '::/0'],
            ...(proxy.reserved?.length ? { reserved: proxy.reserved } : {}),
            ...(proxy['persistent-keepalive']
              ? { persistent_keepalive_interval: proxy['persistent-keepalive'] }
              : {}),
          },
        ]

  return {
    endpoint: {
      type: 'wireguard',
      tag: proxy.name,
      address: addresses,
      private_key: proxy['private-key'],
      ...(proxy.mtu ? { mtu: proxy.mtu } : {}),
      ...(proxy.workers ? { workers: proxy.workers } : {}),
      peers,
      ...(proxy.detour ? { detour: proxy.detour } : {}),
    },
  }
}

export const wireGuardCodec: ProtocolCodec<WireGuardProxy> = {
  types: ['wireguard'],
  prefixes: ['wireguard://', 'wg://'],
  parse: parseWireGuardUri,
  validate: validateWireGuardProxy,
  toUri: wireGuardToUri,
  toClashProxy: wireGuardToClashProxy,
  toSingboxOutbound: () => null,
  toSingboxBundle: wireGuardToSingboxBundle,
}
