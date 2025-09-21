import { Proxy, SingboxProxyConfig } from '../types'

/**
 * Hysteria2 协议解析器
 */
export class Hysteria2Protocol {
  /**
   * 解析 Hysteria2 节点
   * @param uri hysteria2://或hy2://开头的节点链接
   */
  static parse(uri: string): Proxy {
    // 处理 hy2:// 前缀
    const actualUri = uri.startsWith('hy2://') ? 'hysteria2://' + uri.substring(6) : uri
    const url = new URL(actualUri)

    // 处理 IPv6 地址，移除方括号
    let server = url.hostname
    if (server.startsWith('[') && server.endsWith(']')) {
      server = server.substring(1, server.length - 1)
    }

    return {
      type: 'hysteria2',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : server,
      server: server,
      port: parseInt(url.port),
      password: url.username,
      sni: url.searchParams.get('sni') || '',
      'skip-cert-verify': url.searchParams.get('insecure') === '1',
      alpn: url.searchParams.get('alpn')?.split(',') || ['h3'],
      tfo: false
    }
  }

  /**
   * 验证 Hysteria2 节点配置
   * @param proxy 代理配置
   * @returns 是否有效
   */
  static validate(proxy: Proxy): boolean {
    return proxy.type === 'hysteria2' && !!(proxy.password)
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy Hysteria2代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'hysteria2') {
      return null;
    }

    return {
      type: 'hysteria2',
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      password: proxy.password || '',
      tls: {
        enabled: true,
        server_name: proxy.sni || proxy.server,
        insecure: true
      }
    }
  }
}

// 兼容性导出
export const parseHysteria2 = Hysteria2Protocol.parse