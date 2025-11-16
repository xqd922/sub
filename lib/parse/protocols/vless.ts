import { Proxy, SingboxProxyConfig } from '../../core/types'

/**
 * VLess 协议解析器
 */
export class VLessProtocol {
  /**
   * 解析 VLess 节点
   * @param uri vless://开头的节点链接
   */
  static parse(uri: string): Proxy {
    const url = new URL(uri)

    // 处理 IPv6 地址，移除方括号
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

    // 简化输出格式
    return {
      type: 'vless',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
      server: server,
      port: parseInt(url.port),
      uuid: url.username,
      tls: security === 'tls' || security === 'reality',
      flow: flow || '',
      servername: sni,
      'skip-cert-verify': false,
      'client-fingerprint': fp,
      network: type,
      tfo: false,

      // 如果是 Reality 节点
      ...(pbk && {
        'reality-opts': {
          'public-key': pbk,
          'short-id': sid || ''
        }
      }),

      // 如果是 WS 类型
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

  /**
   * 验证 VLess 节点配置
   * @param proxy 代理配置
   * @returns 是否有效
   */
  static validate(proxy: Proxy): boolean {
    return proxy.type === 'vless' && !!(proxy.uuid)
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy VLess代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'vless') {
      return null;
    }

    const realityOpts = proxy['reality-opts'];

    const config: SingboxProxyConfig = {
      type: 'vless',
      tag: proxy.name,
      server: proxy.server,
      server_port: typeof proxy.port === 'number' ? proxy.port : parseInt(String(proxy.port)),
      uuid: proxy.uuid || '',
      flow: proxy.flow || '',
      packet_encoding: 'xudp'
    }

    // 添加TLS配置
    if (proxy.tls) {
      config.tls = {
        enabled: true,
        server_name: proxy.servername || proxy.sni || proxy.server,
        insecure: proxy['skip-cert-verify'] ?? false,
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

    // 添加传输配置
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

    return config
  }
}

// 兼容性导出
export const parseVless = VLessProtocol.parse