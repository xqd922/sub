import { Proxy } from '@/lib/types'
import { filterNodes } from '@/lib/nodeUtils'

// 转换节点为 sing-box 格式
export function convertNodes(proxies: Proxy[], shouldFormatNames: boolean = true) {
  // 根据shouldFormatNames参数决定是否进行名称格式化
  const formattedProxies = shouldFormatNames ? filterNodes(proxies) : proxies
  
  const outbounds = formattedProxies.map(proxy => {
    switch (proxy.type) {
      case 'ss':
        return {
          type: 'shadowsocks',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          method: proxy.cipher,
          password: proxy.password
        }
      case 'vmess':
        return {
          type: 'vmess',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          security: proxy.cipher || 'auto',
          alter_id: proxy.alterId || 0,
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.server,
            insecure: true
          } : undefined,
          ...(proxy.network && proxy.network !== 'tcp' ? {
            transport: {
              type: proxy.network,
              path: proxy['ws-opts']?.path || proxy.wsPath || '',
              headers: proxy['ws-opts']?.headers || proxy.wsHeaders || undefined
            }
          } : {})
        }
      case 'trojan':
        return {
          type: 'trojan',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          password: proxy.password,
          tls: {
            enabled: true,
            server_name: proxy.sni || proxy.server,
            insecure: true
          }
        }
      case 'hysteria2':
        return {
          type: 'hysteria2',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          password: proxy.password,
          tls: {
            enabled: true,
            server_name: proxy.sni || proxy.server,
            insecure: true
          }
        }
      case 'vless':
        return {
          type: 'vless',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          flow: proxy.flow || '',
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.sni || proxy.server,
            insecure: proxy['skip-cert-verify'] || true,
            reality: proxy['reality-opts'] ? {
              public_key: proxy['reality-opts']['public-key'] || '',
              short_id: proxy['reality-opts']['short-id'] || ''
            } : undefined
          } : undefined,
          ...(proxy.network && proxy.network !== 'tcp' ? {
            transport: {
              type: proxy.network,
              path: proxy['ws-opts']?.path || '',
              headers: proxy['ws-opts']?.headers || undefined
            }
          } : {}),
          packet_encoding: 'xudp'
        }
      default:
        return null
    }
  }).filter(Boolean)

  return outbounds.filter((o): o is NonNullable<typeof o> => o !== null)
} 