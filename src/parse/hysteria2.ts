import { Proxy, SingboxProxyConfig } from '@/types'
import { parsePort } from '@/utils'

export function parse(uri: string): Proxy {

  const actualUri = uri.startsWith('hy2://') ? 'hysteria2://' + uri.substring(6) : uri
  const url = new URL(actualUri)

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const upParam = url.searchParams.get('up')
  const downParam = url.searchParams.get('down')

  const obfs = url.searchParams.get('obfs')
  const obfsPassword = url.searchParams.get('obfs-password')

  return {
    type: 'hysteria2',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    password: url.username,
    sni: url.searchParams.get('sni') || '',
    'skip-cert-verify': url.searchParams.get('insecure') === '1',
    'client-fingerprint': url.searchParams.get('fp') || url.searchParams.get('fingerprint') || 'chrome',
    alpn: url.searchParams.get('alpn')?.split(',') || ['h3'],
    up: upParam || undefined,
    down: downParam || undefined,
    obfs: obfs || undefined,
    'obfs-password': obfsPassword || undefined
  }
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'hysteria2' && !!(proxy.password)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'hysteria2') {
    return null;
  }

  const config: SingboxProxyConfig = {
    type: 'hysteria2',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false
    }
  };

  if (proxy.obfs && proxy['obfs-password']) {
    config.obfs = {
      type: proxy.obfs,
      password: proxy['obfs-password']
    };
  }

  if (proxy.detour) {
    config.detour = proxy.detour
  }

  return config;
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'hysteria2') return null

  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('insecure', '1')
  if (proxy.obfs) params.set('obfs', proxy.obfs)
  if (proxy['obfs-password']) params.set('obfs-password', proxy['obfs-password'])

  const query = params.toString() ? `?${params.toString()}` : ''
  const name = encodeURIComponent(proxy.name)
  return `hy2://${proxy.password}@${proxy.server}:${proxy.port}${query}#${name}`
}

// ponytail: 兼容性导出
export const parseHysteria2 = parse