import { Proxy, SingboxProxyConfig } from '../../core/types'

/**
 * Trojan 协议解析器
 */
export class TrojanProtocol {
  /**
   * 解析 Trojan 节点
   * @param uri trojan://开头的节点链接
   */
  static parse(uri: string): Proxy {
    const url = new URL(uri)
    const params = url.searchParams

    const proxy: Proxy = {
      type: 'trojan',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname,
      server: url.hostname,
      port: parseInt(url.port),
      password: url.username,
      sni: params.get('sni') || url.hostname,
      udp: true,
      skipCertVerify: params.get('allowInsecure') === '1'
    }

    // 处理传输协议
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

  /**
   * 验证 Trojan 节点配置
   * @param proxy 代理配置
   * @returns 是否有效
   */
  static validate(proxy: Proxy): boolean {
    return proxy.type === 'trojan' && !!(proxy.password)
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy Trojan代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'trojan') {
      return null;
    }

    const trojanConfig: SingboxProxyConfig = {
      type: 'trojan',
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      password: proxy.password || '',
      tls: {
        enabled: true,
        server_name: proxy.sni || proxy.server,
        insecure: proxy.skipCertVerify || true
      }
    }

    // 添加传输协议配置
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

    return trojanConfig
  }
}

// 兼容性导出
export const parseTrojan = TrojanProtocol.parse