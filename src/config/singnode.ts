import { Proxy } from '@/lib/types'
import { filterNodes } from '@/lib/nodeUtils'

// 转换节点为 sing-box 格式
export function convertNodes(proxies: Proxy[]) {
  const formattedProxies = filterNodes(proxies)
  
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
          tls: proxy.tls,
          transport: {
            type: proxy.network,
            path: proxy.wsPath,
            headers: proxy.wsHeaders
          }
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
          up_mbps: 100,
          down_mbps: 100,
          tls: {
            enabled: true,
            server_name: proxy.sni,
            insecure: proxy.skipCertVerify,
            alpn: ['h3']
          }
        }
      case 'vless':
        return {
          type: 'vless',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          flow: proxy.flow,
          tls: {
            enabled: true,
            server_name: proxy.sni,
            insecure: proxy.skipCertVerify,
            utls: {
              enabled: true,
              fingerprint: proxy['client-fingerprint'] || 'chrome'
            }
          },
          transport: proxy.network ? {
            type: proxy.network,
            path: proxy.wsPath,
            headers: proxy.wsHeaders,
            servername: proxy.servername
          } : undefined,
          packet_encoding: 'xudp'
        }
      default:
        return null
    }
  }).filter(Boolean)

  return outbounds.filter((o): o is NonNullable<typeof o> => o !== null)
} 