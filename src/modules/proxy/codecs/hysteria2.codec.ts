import {
  extractFragmentName,
  formatHostForUri,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  Hysteria2Proxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseHysteria2Uri(uri: string): Hysteria2Proxy {
  const normalized = uri.startsWith('hy2://') ? `hysteria2://${uri.slice(6)}` : uri
  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const upParam = params.get('up')
  const downParam = params.get('down')
  const obfs = params.get('obfs')
  const obfsPassword = params.get('obfs-password')

  return {
    type: 'hysteria2',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    password: url.username,
    sni: params.get('sni') || '',
    'skip-cert-verify': params.get('insecure') === '1',
    'client-fingerprint': params.get('fp') || params.get('fingerprint') || 'chrome',
    alpn: params.get('alpn')?.split(',') || ['h3'],
    up: upParam || undefined,
    down: downParam || undefined,
    obfs: obfs || undefined,
    'obfs-password': obfsPassword || undefined,
  }
}

export function validateHysteria2Proxy(proxy: Proxy): boolean {
  return proxy.type === 'hysteria2' && Boolean(proxy.password)
}

export function hysteria2ToUri(proxy: Hysteria2Proxy): string {
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy.obfs) params.set('obfs', proxy.obfs)
  if (proxy['obfs-password']) params.set('obfs-password', proxy['obfs-password'])

  const query = params.toString() ? `?${params.toString()}` : ''
  return `hy2://${proxy.password}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function hysteria2ToSingboxOutbound(proxy: Hysteria2Proxy): SingboxOutbound {
  const outbound: SingboxOutbound = {
    type: 'hysteria2',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false,
    },
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
