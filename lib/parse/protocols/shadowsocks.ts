import { Proxy, SingboxProxyConfig } from '../../core/types'
import { logger } from '../../core/logger'

/**
 * Shadowsocks 协议解析器
 */
export class SSProtocol {
  /**
   * 解析 Shadowsocks 节点
   * @param uri ss://开头的节点链接
   */
  static parse(uri: string): Proxy {
    // 移除 ss:// 前缀
    const content = uri.substring(5)

    // 处理 URL 编码的字符
    const decodedContent = decodeURIComponent(content)

    // 分离主体和备注
    const [mainPart = '', remark = ''] = decodedContent.split('#')

    if (!mainPart) {
      throw new Error('SS链接格式错误：缺少主体部分')
    }

    // 解析主体部分
    let decoded: string
    const pluginOpts: Record<string, string> = {}

    try {
      // 检查是否有插件参数
      const [basePart = '', queryString] = mainPart.split('/?')

      if (queryString) {
        const params = new URLSearchParams(queryString)
        const plugin = params.get('plugin')
        if (plugin) {
          // 解析插件参数
          const pluginParams = plugin.split(';')
          pluginParams.forEach(param => {
            const [key, value] = param.split('=')
            if (key && value) {
              if (key === 'obfs') {
                pluginOpts['obfs'] = value
              } else if (key === 'obfs-host') {
                pluginOpts['obfs-host'] = value
              }
            }
          })
        }
      }

      // 处理 Base64 编码，确保兼容不同的编码方式
      const standardBase64 = basePart
        .replace(/-/g, '+')   // URL 安全的 Base64 替换
        .replace(/_/g, '/')   // URL 安全的 Base64 替换

      // 补全 Base64 编码（如果需要）
      const paddedBase64 = standardBase64 +
        '=='.slice(0, (4 - standardBase64.length % 4) % 4)

      // 检查是否包含 @ 符号
      if (basePart.includes('@')) {
        // 新格式: userInfo@server:port
        const [userInfo = '', serverPart] = paddedBase64.split('@')
        if (!userInfo) {
          throw new Error('SS链接格式错误：缺少用户信息')
        }
        const decodedUserInfo = Buffer.from(userInfo, 'base64').toString('utf-8')
        decoded = `${decodedUserInfo}@${serverPart}`
      } else {
        // 旧格式: 整个字符串都是 base64
        decoded = Buffer.from(paddedBase64, 'base64').toString('utf-8')
      }
    } catch (error) {
      logger.error('SS链接解析错误:', {
        uri,
        error: error instanceof Error ? error.message : error
      })
      throw new Error('无效的 SS 链接格式：Base64 解码失败')
    }

    // 解析服务器信息
    const [methodAndPassword, serverAndPort] = decoded.split('@')
    if (!methodAndPassword || !serverAndPort) {
      throw new Error(`无效的 SS 链接格式：解析失败 - ${decoded}`)
    }

    // 尝试标准解析
    let method: string, password: string
    try {
      // 尝试标准 method:password 解析
      const parts = methodAndPassword.split(':')

      if (parts.length === 2) {
        // 标准两部分格式
        method = parts[0] || 'aes-256-gcm'
        password = parts[1] || ''
      } else if (parts.length > 2) {
        // 多部分密码格式
        method = parts[0] || 'aes-256-gcm'
        // 将除第一个部分外的所有部分作为密码
        password = parts.slice(1).join(':')
      } else {
        // 尝试 Base64 解码
        const decodedParts = Buffer.from(methodAndPassword, 'base64').toString('utf-8').split(':')

        if (decodedParts.length >= 2) {
          method = 'chacha20-ietf-poly1305'
          password = decodedParts.join(':')
        } else {
          throw new Error('无法解析')
        }
      }
    } catch {
      // 兜底方案
      method = 'chacha20-ietf-poly1305'
      password = methodAndPassword
    }

    // 处理 IPv6 地址
    const ipv6Match = serverAndPort.match(/\[(.*)\]:(\d+)/)
    let server: string
    let port: string

    if (ipv6Match) {
      // IPv6 格式
      const [, ipv6Server, ipv6Port] = ipv6Match
      server = ipv6Server || 'localhost'
      port = ipv6Port || '8080'
    } else {
      // IPv4 或域名格式
      const lastColon = serverAndPort.lastIndexOf(':')
      server = serverAndPort.substring(0, lastColon)
      port = serverAndPort.substring(lastColon + 1)
    }

    // 严格验证参数
    if (!method) {
      throw new Error('SS 链接缺少加密方法')
    }
    if (!password) {
      throw new Error('SS 链接缺少密码')
    }
    if (!server) {
      throw new Error('SS 链接缺少服务器地址')
    }
    if (!port) {
      throw new Error('SS 链接缺少端口')
    }

    // 清理密码中 \r 及之后的所有内容
    const cleanPassword = (password || '').split('\r')[0]?.trim() || '';

    // 尝试解码备注
    let decodedRemark = ''
    try {
      decodedRemark = decodeURIComponent(remark)
    } catch {
      decodedRemark = remark
    }

    // 构建基本节点配置
    const proxy: Proxy = {
      type: 'ss',
      name: decodedRemark || server,
      server,
      port: parseInt(port),
      'client-fingerprint': 'chrome',
      cipher: method,
      password: cleanPassword
    }

    // 如果存在 obfs 配置，设置为新的格式
    if (pluginOpts['obfs']) {
      proxy.plugin = 'obfs'
      proxy['plugin-opts'] = {
        mode: pluginOpts['obfs'] || 'http',
        ...(pluginOpts['obfs-host'] && { host: pluginOpts['obfs-host'] })
      }
    }

    return proxy
  }

  /**
   * 生成 SS URL
   * @param proxy SS 节点配置
   * @returns SS URL 字符串
   */
  static generateURL(proxy: Proxy): string {
    // 生成基本的用户信息
    const userInfo = `${proxy['encrypt-method'] || proxy.cipher}:${proxy.password}`;
    const baseInfo = `${proxy.server}:${proxy.port}`;

    // Base64 编码
    const base64UserInfo = Buffer.from(userInfo).toString('base64');

    // 构建基本 URL
    let url = `ss://${base64UserInfo}@${baseInfo}`;

    // 添加备注（如果有）
    if (proxy.name && proxy.name !== proxy.server) {
      url += `#${encodeURIComponent(proxy.name)}`;
    }

    return url;
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy SS代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'ss') {
      return null;
    }

    return {
      type: 'shadowsocks',
      tag: proxy.name,
      server: proxy.server,
      server_port: proxy.port,
      method: proxy['encrypt-method'] || proxy.cipher || 'aes-256-gcm',
      password: proxy.password || '',
      // 添加插件支持
      ...(proxy.plugin === 'obfs' && proxy['plugin-opts'] && {
        plugin: "obfs-local",
        plugin_opts: `obfs=${proxy['plugin-opts'].mode};obfs-host=${proxy['plugin-opts'].host || 'www.bing.com'}`
      }),
      // 兼容Clash格式的obfs配置
      ...(proxy.obfs && {
        plugin: "obfs-local",
        plugin_opts: `obfs=${proxy.obfs};obfs-host=${proxy['obfs-host'] || 'www.bing.com'}`
      })
    }
  }
}

// 兼容性导出
export const parseShadowsocks = SSProtocol.parse
export const generateShadowsocksURL = SSProtocol.generateURL