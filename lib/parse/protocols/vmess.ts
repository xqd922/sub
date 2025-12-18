import { Proxy, SingboxProxyConfig } from '../../core/types'

/**
 * VMess 协议解析器
 */
export class VMessProtocol {
  /**
   * 解析 VMess 节点
   * @param uri vmess://开头的节点链接
   */
  static parse(uri: string): Proxy {
    const content = uri.substring(8)
    const config = JSON.parse(Buffer.from(content, 'base64').toString())

    // 处理 IPv6 地址，移除可能的方括号
    let server = config.add
    if (server.startsWith('[') && server.endsWith(']')) {
      server = server.substring(1, server.length - 1)
    }

    // 根据网络类型设置相应选项
    const network = config.net || 'tcp'
    const isWs = network === 'ws'

    return {
      type: 'vmess',
      name: config.ps || server,
      server: server,
      port: parseInt(config.port),
      uuid: config.id,
      alterId: parseInt(config.aid) || 0,
      cipher: 'auto',
      network: network,
      tls: config.tls === 'tls',
      'skip-cert-verify': false,
      servername: config.sni || '',
      tfo: false,

      // 如果是 WS 类型
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

  /**
   * 验证 VMess 节点配置
   * @param proxy 代理配置
   * @returns 是否有效
   */
  static validate(proxy: Proxy): boolean {
    return proxy.type === 'vmess' && !!(proxy.uuid)
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy VMess代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'vmess') {
      return null;
    }

    const config: SingboxProxyConfig = {
      type: 'vmess',
      tag: proxy.name,
      server: proxy.server,
      server_port: typeof proxy.port === 'number' ? proxy.port : parseInt(String(proxy.port)),
      uuid: proxy.uuid || '',
      security: proxy.cipher || 'auto',
      alter_id: proxy.alterId || 0
    }

    // 添加TLS配置
    if (proxy.tls) {
      config.tls = {
        enabled: true,
        server_name: proxy.servername || proxy.server,
        insecure: proxy['skip-cert-verify'] ?? false
      }
    }

    // 添加传输配置
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

    // 添加链式代理支持（Sing-box 使用 detour 字段）
    if (proxy.detour) {
      config.detour = proxy.detour
    }

    return config
  }
  /**
   * 将 Proxy 对象转换为 VMess URI
   */
  static toUri(proxy: Proxy): string | null {
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
}

// 兼容性导出
export const parseVmess = VMessProtocol.parse