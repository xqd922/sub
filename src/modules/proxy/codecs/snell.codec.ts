import {
  extractFragmentName,
  formatHostForUri,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  SnellProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseSnellUri(uri: string): SnellProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const proxy: SnellProxy = {
    type: 'snell',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    psk: params.get('psk') || '',
    udp: params.get('udp') !== 'false',
  }

  const version = params.get('version')
  if (version) proxy.version = parseInt(version, 10)

  const reuse = params.get('reuse')
  if (reuse === '1' || reuse === 'true') proxy.reuse = true

  const clientFingerprint = params.get('client-fingerprint') || params.get('fp')
  if (clientFingerprint) proxy['client-fingerprint'] = clientFingerprint

  const obfsMode = params.get('obfs')
  if (obfsMode) {
    proxy['obfs-opts'] = {
      mode: obfsMode,
      host: params.get('obfs-host') || 'bing.com',
    }
  }

  const shadowTlsPassword = params.get('shadow-tls-password')
  if (shadowTlsPassword && proxy['obfs-opts']?.mode === 'shadow-tls') {
    proxy['obfs-opts'].password = shadowTlsPassword
    const stlsVersion = params.get('shadow-tls-version')
    proxy['obfs-opts'].version = stlsVersion ? parseInt(stlsVersion, 10) : undefined
    proxy['obfs-opts']['skip-cert-verify'] = params.get('shadow-tls-insecure') === '1'
    const stlsFp = params.get('shadow-tls-fingerprint')
    if (stlsFp) proxy['obfs-opts'].fingerprint = stlsFp
    const stlsAlpn = params.get('shadow-tls-alpn')
    if (stlsAlpn) proxy['obfs-opts'].alpn = stlsAlpn.split(',')
  }

  const tfo = params.get('tfo')
  if (tfo === '1' || tfo === 'true') proxy.tfo = true

  return proxy
}

export function validateSnellProxy(proxy: Proxy): boolean {
  return proxy.type === 'snell' && Boolean(proxy.psk)
}

export function snellToUri(proxy: SnellProxy): string {
  const params = new URLSearchParams()
  if (proxy.psk) params.set('psk', proxy.psk)
  if (proxy.version) params.set('version', String(proxy.version))
  if (proxy.reuse) params.set('reuse', '1')
  if (proxy['client-fingerprint']) params.set('client-fingerprint', proxy['client-fingerprint'])
  if (proxy['obfs-opts']?.mode) {
    params.set('obfs', proxy['obfs-opts'].mode)
    if (proxy['obfs-opts'].host) params.set('obfs-host', proxy['obfs-opts'].host)
  }
  if (proxy.tfo) params.set('tfo', '1')

  const query = params.toString() ? `?${params.toString()}` : ''
  return `snell://${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function snellToSingboxOutbound(proxy: SnellProxy): SingboxOutbound {
  const version = proxy.version || 4
  const outbound: SingboxOutbound = {
    type: 'snell',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    version,
    psk: proxy.psk || '',
    reuse: proxy.reuse ?? false,
    network: proxy.udp === false ? 'tcp' : undefined,
  }

  if (version === 4 && proxy['obfs-opts']?.mode) {
    outbound.obfs_mode = proxy['obfs-opts'].mode
    if (proxy['obfs-opts'].host) {
      outbound.obfs_host = proxy['obfs-opts'].host
    }
  }

  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const snellCodec: ProtocolCodec<SnellProxy> = {
  types: ['snell'],
  prefixes: ['snell://'],
  parse: parseSnellUri,
  validate: validateSnellProxy,
  toUri: snellToUri,
  toSingboxOutbound: snellToSingboxOutbound,
}
