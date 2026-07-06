import { Proxy, SingboxProxyConfig } from '@/types'
import { parsePort } from '@/utils'

export function parse(uri: string): Proxy {
  const url = new URL(uri)
  const params = url.searchParams

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const proxy: Proxy = {
    type: 'snell',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    psk: params.get('psk') || '',
    udp: params.get('udp') !== 'false',
  }

  const version = params.get('version')
  if (version) {
    proxy.version = parseInt(version, 10)
  }

  const reuse = params.get('reuse')
  if (reuse === '1' || reuse === 'true') {
    proxy.reuse = true
  }

  const clientFingerprint = params.get('client-fingerprint') || params.get('fp')
  if (clientFingerprint) {
    proxy['client-fingerprint'] = clientFingerprint
  }

  // obfs 混淆
  const obfsMode = params.get('obfs')
  if (obfsMode) {
    proxy['obfs-opts'] = {
      mode: obfsMode,
      host: params.get('obfs-host') || 'bing.com',
    }
  }

  // shadow-tls 子选项
  const shadowTlsPassword = params.get('shadow-tls-password')
  if (shadowTlsPassword && proxy['obfs-opts']?.mode === 'shadow-tls') {
    proxy['obfs-opts'].password = shadowTlsPassword
    proxy['obfs-opts'].version = params.get('shadow-tls-version')
      ? parseInt(params.get('shadow-tls-version')!, 10) : undefined
    proxy['obfs-opts']['skip-cert-verify'] = params.get('shadow-tls-insecure') === '1'
    const stlsFp = params.get('shadow-tls-fingerprint')
    if (stlsFp) proxy['obfs-opts'].fingerprint = stlsFp
    const stlsAlpn = params.get('shadow-tls-alpn')
    if (stlsAlpn) proxy['obfs-opts'].alpn = stlsAlpn.split(',')
  }

  const tfo = params.get('tfo')
  if (tfo === '1' || tfo === 'true') {
    proxy.tfo = true
  }

  return proxy
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'snell' && !!(proxy.psk)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'snell') return null

  const version = proxy.version || 4

  const config: SingboxProxyConfig = {
    type: 'snell',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    version,
    psk: proxy.psk || '',
    reuse: proxy.reuse ?? false,
    network: proxy.udp === false ? 'tcp' : undefined,
  }

  // v4: obfs
  if (version === 4 && proxy['obfs-opts']?.mode) {
    config.obfs_mode = proxy['obfs-opts'].mode
    if (proxy['obfs-opts'].host) {
      config.obfs_host = proxy['obfs-opts'].host
    }
  }

  if (proxy.detour) {
    config.detour = proxy.detour
  }

  return config
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'snell') return null

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
  const name = encodeURIComponent(proxy.name)
  const host = proxy.server.includes(':') ? `[${proxy.server}]` : proxy.server
  return `snell://${host}:${proxy.port}${query}#${name}`
}

// ponytail: 兼容性导出
export const parseSnell = parse
