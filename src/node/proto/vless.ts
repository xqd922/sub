import { Proxy } from '@/node/types'
import { SingboxProxyConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'

export function parse(uri: string): Proxy {
  const url = new URL(uri)

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const host = url.searchParams.get('host')
  const flow = url.searchParams.get('flow')
  const fp = url.searchParams.get('fp') || 'chrome'
  const security = url.searchParams.get('security') || 'none'
  const type = url.searchParams.get('type') || 'tcp'
  const pbk = url.searchParams.get('pbk')
  const sid = url.searchParams.get('sid')
  const sni = url.searchParams.get('sni') || ''
  const alpn = url.searchParams.get('alpn')

  const allowInsecure = url.searchParams.get('allowInsecure') || url.searchParams.get('skip-cert-verify')
  const skipCertVerify = allowInsecure === '1' || allowInsecure === 'true'

  return {
    type: 'vless',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    uuid: url.username,
    tls: security === 'tls' || security === 'reality',
    ...(flow && { flow }),
    servername: sni,
    'skip-cert-verify': skipCertVerify,
    'client-fingerprint': fp,
    network: type,
    tfo: false,
    ...(alpn && { alpn: alpn.split(',') }),

    ...(pbk && {
      'reality-opts': {
        'public-key': pbk,
        'short-id': sid || ''
      }
    }),

    ...(type === 'ws' && {
      'ws-opts': {
        path: url.searchParams.get('path') || '',
        headers: {
          Host: host || server
        }
      }
    })
  }
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'vless' && !!(proxy.uuid)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'vless') {
    return null;
  }

  const realityOpts = proxy['reality-opts'];

  const config: SingboxProxyConfig = {
    type: 'vless',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    ...(proxy.flow && { flow: proxy.flow }),
    packet_encoding: 'xudp'
  }

  if (proxy.tls) {
    config.tls = {
      enabled: true,
      server_name: proxy.servername || proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false,
      ...(proxy.alpn && {
        alpn: Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn]
      }),
      ...(realityOpts ? {
        reality: {
          enabled: true,
          public_key: realityOpts['public-key'] || '',
          short_id: realityOpts['short-id'] || ''
        },
        utls: {
          enabled: true,
          fingerprint: proxy['client-fingerprint'] || 'chrome'
        }
      } : {})
    }
  }

  if (proxy.network && proxy.network !== 'tcp') {
    config.transport = {
      type: proxy.network,
      ...(proxy.network === 'ws' ? {
        path: proxy['ws-opts']?.path || '',
        headers: Object.fromEntries(
          Object.entries(proxy['ws-opts']?.headers || {})
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, value as string])
        )
      } : {})
    }
  }

  if (proxy.detour) {
    config.detour = proxy.detour
  }

  return config
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'vless') return null

  const params = new URLSearchParams()
  params.set('type', proxy.network || 'tcp')
  params.set('security', proxy.tls ? (proxy['reality-opts'] ? 'reality' : 'tls') : 'none')

  if (proxy.servername || proxy.sni) params.set('sni', proxy.servername || proxy.sni || '')
  if (proxy.flow) params.set('flow', proxy.flow)
  if (proxy['client-fingerprint']) params.set('fp', proxy['client-fingerprint'])
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)

  if (proxy['reality-opts']) {
    params.set('pbk', proxy['reality-opts']['public-key'] || '')
    if (proxy['reality-opts']['short-id']) params.set('sid', proxy['reality-opts']['short-id'])
  }

  if (proxy.network === 'ws' && proxy['ws-opts']) {
    if (proxy['ws-opts'].path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts'].headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
  }

  const name = encodeURIComponent(proxy.name)
  return `vless://${proxy.uuid}@${proxy.server}:${proxy.port}?${params.toString()}#${name}`
}

// ponytail: 兼容性导出
export const parseVless = parse