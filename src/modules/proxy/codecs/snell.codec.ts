import {
  buildShadowTlsSingboxOutbound,
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  ShadowTlsOptions,
  SingboxConversionBundle,
  SingboxOutbound,
  SnellProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseSnellUri(uri: string): SnellProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const versionStr = params.get('version')
  const version = versionStr ? parseInt(versionStr, 10) : undefined
  // 同时兼容 snell://psk@host:port 和 snell://host:port?psk=...
  const psk = params.get('psk') || params.get('secret') || safeDecodeUriComponent(url.username) || ''
  const userkey = params.get('userkey') || undefined
  const mode = params.get('mode') || undefined
  // Snell v1/v2 在 Mihomo 中不支持 UDP
  const defaultUdp = version !== undefined && version <= 2 ? false : true
  const udp = params.get('udp') === 'false' || params.get('udp') === '0' ? false : defaultUdp

  const proxy: SnellProxy = {
    type: 'snell',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    psk,
    ...(userkey ? { userkey } : {}),
    ...(version && !Number.isNaN(version) ? { version } : {}),
    ...(mode ? { mode } : {}),
    udp,
  }

  if (parseBoolFlag(params.get('reuse'))) proxy.reuse = true

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
    if (stlsVersion) proxy['obfs-opts'].version = parseInt(stlsVersion, 10)
    if (parseBoolFlag(params.get('shadow-tls-insecure'))) {
      proxy['obfs-opts']['skip-cert-verify'] = true
    }
    const stlsFp = params.get('shadow-tls-fingerprint')
    if (stlsFp) proxy['obfs-opts'].fingerprint = stlsFp
    const stlsAlpn = params.get('shadow-tls-alpn')
    if (stlsAlpn) proxy['obfs-opts'].alpn = normalizeAlpnList(stlsAlpn)
  }

  if (parseBoolFlag(params.get('tfo'))) proxy.tfo = true

  return proxy
}

export function validateSnellProxy(proxy: Proxy): boolean {
  return proxy.type === 'snell' && Boolean(proxy.psk)
}

export function snellToUri(proxy: SnellProxy): string {
  const params = new URLSearchParams()
  if (proxy.psk) params.set('psk', proxy.psk)
  if (proxy.userkey) params.set('userkey', proxy.userkey)
  if (proxy.version) params.set('version', String(proxy.version))
  if (proxy.mode) params.set('mode', proxy.mode)
  if (proxy.reuse) params.set('reuse', '1')
  if (proxy.udp === false) params.set('udp', 'false')
  if (proxy['client-fingerprint']) params.set('client-fingerprint', proxy['client-fingerprint'])

  const obfsMode = proxy['obfs-opts']?.mode || proxy.obfs
  const obfsHost = proxy['obfs-opts']?.host || proxy['obfs-host']
  if (obfsMode) {
    params.set('obfs', obfsMode)
    if (obfsHost) params.set('obfs-host', obfsHost)
    if (obfsMode === 'shadow-tls' && proxy['obfs-opts']) {
      if (proxy['obfs-opts'].password) params.set('shadow-tls-password', proxy['obfs-opts'].password)
      if (proxy['obfs-opts'].version) params.set('shadow-tls-version', String(proxy['obfs-opts'].version))
      if (proxy['obfs-opts']['skip-cert-verify']) params.set('shadow-tls-insecure', '1')
      if (proxy['obfs-opts'].fingerprint) {
        params.set('shadow-tls-fingerprint', proxy['obfs-opts'].fingerprint)
      }
      if (proxy['obfs-opts'].alpn?.length) {
        params.set('shadow-tls-alpn', proxy['obfs-opts'].alpn.join(','))
      }
    }
  }
  if (proxy.tfo) params.set('tfo', '1')

  const query = params.toString() ? `?${params.toString()}` : ''
  return `snell://${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function snellToClashProxy(proxy: SnellProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  const version = typeof cleaned.version === 'number' ? cleaned.version : 4
  // Mihomo 规定 Snell v1/v2 不能开启 udp: true
  if (version <= 2) {
    delete cleaned.udp
  }
  // mode 仅 Snell v6 支持
  if (version !== 6) {
    delete cleaned.mode
  }
  // 将扁平 obfs/obfs-host 规范为 obfs-opts
  if (!cleaned['obfs-opts'] && proxy.obfs) {
    cleaned['obfs-opts'] = {
      mode: proxy.obfs,
      ...(proxy['obfs-host'] ? { host: proxy['obfs-host'] } : {}),
    }
  }
  delete cleaned.obfs
  delete cleaned['obfs-host']
  return cleaned
}

export function snellToSingboxBundle(proxy: SnellProxy): SingboxConversionBundle | null {
  const rawVersion = proxy.version || 4
  // sing-box 仅支持 Snell v4 / v6（v5 服务端向下兼容 v4 客户端）
  if (rawVersion < 4 || rawVersion > 6) {
    return null
  }
  const singboxVersion = rawVersion === 5 ? 4 : rawVersion
  const obfsMode = proxy['obfs-opts']?.mode || proxy.obfs
  const obfsHost = proxy['obfs-opts']?.host || proxy['obfs-host']

  const outbound: SingboxOutbound = {
    type: 'snell',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    version: singboxVersion,
    psk: proxy.psk || '',
    ...(proxy.userkey ? { userkey: proxy.userkey } : {}),
    reuse: proxy.reuse ?? false,
    ...(proxy.udp === false ? { network: 'tcp' } : {}),
    ...(proxy.tfo ? { tcp_fast_open: true } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }

  if (singboxVersion === 6) {
    if (proxy.mode) {
      outbound.mode = proxy.mode
    }
  } else if (obfsMode === 'http' || obfsMode === 'tls' || obfsMode === 'none') {
    outbound.obfs_mode = obfsMode
    if (obfsHost) {
      outbound.obfs_host = obfsHost
    }
  }

  // Snell + shadow-tls：在 sing-box 中拆分为 shadowtls 前置出站 + snell detour
  if (obfsMode === 'shadow-tls' && proxy['obfs-opts']?.password) {
    const stlsTag = `${proxy.name}-shadowtls`
    const stlsOpts: ShadowTlsOptions = {
      host: obfsHost,
      password: proxy['obfs-opts'].password,
      version: proxy['obfs-opts'].version || 3,
      fingerprint: proxy['obfs-opts'].fingerprint,
      'skip-cert-verify': proxy['obfs-opts']['skip-cert-verify'],
      alpn: proxy['obfs-opts'].alpn,
    }
    const stlsOutbound = buildShadowTlsSingboxOutbound(proxy, stlsOpts, stlsTag)
    outbound.detour = stlsTag
    delete outbound.server
    delete outbound.server_port
    return { outbound, extraOutbounds: [stlsOutbound] }
  }

  return { outbound }
}

export function snellToSingboxOutbound(proxy: SnellProxy): SingboxOutbound | null {
  return snellToSingboxBundle(proxy)?.outbound ?? null
}

export const snellCodec: ProtocolCodec<SnellProxy> = {
  types: ['snell'],
  prefixes: ['snell://'],
  parse: parseSnellUri,
  validate: validateSnellProxy,
  toUri: snellToUri,
  toClashProxy: snellToClashProxy,
  toSingboxOutbound: snellToSingboxOutbound,
  toSingboxBundle: snellToSingboxBundle,
}
