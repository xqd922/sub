import { Proxy } from '@/node/types'
import { SingboxProxyConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'

export function parse(uri: string): Proxy {
  const content = uri.substring(8)
  const config = JSON.parse(Buffer.from(content, 'base64').toString())

  let server = config.add
  if (server.startsWith('[') && server.endsWith(']')) {
    server = server.substring(1, server.length - 1)
  }

  const network = config.net || 'tcp'
  const isWs = network === 'ws'

  return {
    type: 'vmess',
    name: config.ps || server,
    server: server,
    port: parsePort(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid) || 0,
    cipher: 'auto',
    network: network,
    tls: config.tls === 'tls',
    'skip-cert-verify': false,
    servername: config.sni || '',
    tfo: false,

    ...(isWs && {
      'ws-opts': {
        path: config.path || '',
        headers: {
          Host: config.host || server
        }
      }
    })
  }
}

export function validate(proxy: Proxy): boolean {
  return proxy.type === 'vmess' && !!(proxy.uuid)
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'vmess') {
    return null;
  }

  const config: SingboxProxyConfig = {
    type: 'vmess',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    security: proxy.cipher || 'auto',
    alter_id: proxy.alterId || 0
  }

  if (proxy.tls) {
    config.tls = {
      enabled: true,
      server_name: proxy.servername || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false
    }
  }

  if (proxy.network && proxy.network !== 'tcp') {
    const headers = proxy['ws-opts']?.headers || proxy.wsHeaders
    config.transport = {
      type: proxy.network,
      path: proxy['ws-opts']?.path || proxy.wsPath || '',
      ...(headers && {
        headers: Object.fromEntries(
          Object.entries(headers)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, value as string])
        )
      })
    }
  }

  if (proxy.detour) {
    config.detour = proxy.detour
  }

  return config
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'vmess') return null

  const config = {
    v: '2',
    ps: proxy.name,
    add: proxy.server,
    port: String(proxy.port),
    id: proxy.uuid,
    aid: String(proxy.alterId || 0),
    scy: proxy.cipher || 'auto',
    net: proxy.network || 'tcp',
    tls: proxy.tls ? 'tls' : '',
    sni: proxy.servername || '',
    host: proxy['ws-opts']?.headers?.Host || proxy.wsHeaders?.Host || '',
    path: proxy['ws-opts']?.path || proxy.wsPath || ''
  }

  return `vmess://${Buffer.from(JSON.stringify(config)).toString('base64')}`
}

// ponytail: 兼容性导出
export const parseVmess = parse