import { Proxy, SingboxProxyConfig } from '../../core/types'

/**
 * AnyTLS 协议解析器
 * 格式: anytls://password@server:port?sni=xxx&skip-cert-verify=true#name
 */
export class AnyTLSProtocol {
  /**
   * 解析 AnyTLS 节点
   * @param uri anytls://开头的节点链接
   */
  static parse(uri: string): Proxy {
    const url = new URL(uri)
    const params = url.searchParams

    const proxy: Proxy = {
      type: 'anytls',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname,
      server: url.hostname,
      port: parseInt(url.port),
      password: decodeURIComponent(url.username),
      sni: params.get('sni') || url.hostname,
      udp: true,
      'skip-cert-verify': params.get('skip-cert-verify') === 'true' || params.get('allowInsecure') === '1'
    }

    // 处理 idle-session-check-interval 和 idle-session-timeout
    const idleCheckInterval = params.get('idle-session-check-interval')
    if (idleCheckInterval) {
      proxy['idle-session-check-interval'] = idleCheckInterval
    }

    const idleTimeout = params.get('idle-session-timeout')
    if (idleTimeout) {
      proxy['idle-session-timeout'] = idleTimeout
    }

    return proxy
  }

  /**
   * 验证 AnyTLS 节点配置
   * @param proxy 代理配置
   * @returns 是否有效
   */
  static validate(proxy: Proxy): boolean {
    return proxy.type === 'anytls' && !!(proxy.password)
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy AnyTLS 代理配置
   * @returns Sing-box 出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'anytls') {
      return null
    }

    const config: SingboxProxyConfig = {
      type: 'anytls',
      tag: proxy.name,
      server: proxy.server,
      server_port: typeof proxy.port === 'number' ? proxy.port : parseInt(String(proxy.port)),
      password: proxy.password || '',
      tls: {
        enabled: true,
        server_name: proxy.sni || proxy.server,
        insecure: proxy['skip-cert-verify'] ?? false
      }
    }

    // 添加 idle 配置
    if (proxy['idle-session-check-interval']) {
      config.idle_session_check_interval = proxy['idle-session-check-interval']
    }
    if (proxy['idle-session-timeout']) {
      config.idle_session_timeout = proxy['idle-session-timeout']
    }

    // 添加链式代理支持
    if (proxy.detour) {
      config.detour = proxy.detour
    }

    return config
  }

  /**
   * 将 Proxy 对象转换为 AnyTLS URI
   */
  static toUri(proxy: Proxy): string | null {
    if (proxy.type !== 'anytls') return null

    const params = new URLSearchParams()
    if (proxy.sni) params.set('sni', proxy.sni)
    if (proxy['skip-cert-verify']) params.set('skip-cert-verify', 'true')
    if (proxy['idle-session-check-interval']) params.set('idle-session-check-interval', proxy['idle-session-check-interval'])
    if (proxy['idle-session-timeout']) params.set('idle-session-timeout', proxy['idle-session-timeout'])

    const query = params.toString() ? `?${params.toString()}` : ''
    const name = encodeURIComponent(proxy.name)
    return `anytls://${encodeURIComponent(proxy.password || '')}@${proxy.server}:${proxy.port}${query}#${name}`
  }
}

// 兼容性导出
export const parseAnyTLS = AnyTLSProtocol.parse
