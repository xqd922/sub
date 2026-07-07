import { Proxy } from '@/node/types'
import { SingboxProxyConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'

export function parse(uri: string): Proxy {
  const url = new URL(uri)
  const params = url.searchParams

  let server = url.hostname
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const proxy: Proxy = {
    type: 'trojan',
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
    server: server,
    port: parsePort(url.port),
    password: url.username,
    sni: url.searchParams.get('sni') || server,
    'skip-cert-verify': url.searchParams.get('allowInsecure') === '1'
  }

  const transportType = params.get('type')
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || ''
    }
    if (params.get('mode') === 'gun') {
      proxy['grpc-opts']['grpc-mode'] = 'gun'
    }
  } else if (transportType === 'ws') {
    proxy.network = 'ws'
    proxy['ws-opts'] = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host')! } : {}
    }
  }

  return proxy
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'trojan' && !!(proxy.password)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'trojan') {
    return null;
  }

  const trojanConfig: SingboxProxyConfig = {
    type: 'trojan',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false
    }
  }

  if (proxy.network === 'grpc' && proxy['grpc-opts']) {
    trojanConfig.transport = {
      type: 'grpc',
      service_name: proxy['grpc-opts']['grpc-service-name'] || '',
      idle_timeout: '15s',
      ping_timeout: '15s'
    }
  } else if (proxy.network === 'ws' && proxy['ws-opts']) {
    const wsHeaders = proxy['ws-opts'].headers || {}
    const cleanHeaders: Record<string, string> = {}
    Object.entries(wsHeaders).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanHeaders[key] = value
      }
    })

    trojanConfig.transport = {
      type: 'ws',
      path: proxy['ws-opts'].path || '/',
      headers: cleanHeaders
    }
  }

  if (proxy.detour) {
    trojanConfig.detour = proxy.detour
  }

  return trojanConfig
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'trojan') return null

  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')

  if (proxy.network === 'ws') {
    params.set('type', 'ws')
    if (proxy['ws-opts']?.path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts']?.headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
  } else if (proxy.network === 'grpc') {
    params.set('type', 'grpc')
    if (proxy['grpc-opts']?.['grpc-service-name']) params.set('serviceName', proxy['grpc-opts']['grpc-service-name'])
    if (proxy['grpc-opts']?.['grpc-mode']) params.set('mode', proxy['grpc-opts']['grpc-mode'])
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  const name = encodeURIComponent(proxy.name)
  return `trojan://${proxy.password}@${proxy.server}:${proxy.port}${query}#${name}`
}

// ponytail: 兼容性导出
export const parseTrojan = parse