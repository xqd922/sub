import { Proxy, SingboxProxyConfig } from '../../core/types'

/**
 * SOCKS 协议解析器
 * 支持格式: socks://username:password@server:port#remark
 * 或: socks://base64(username:password)@server:port#remark
 */
export class SocksProtocol {
  /**
   * 解析 SOCKS 节点
   * @param uri socks://开头的节点链接
   */
  static parse(uri: string): Proxy {
    // 移除 socks:// 前缀
    const content = uri.substring(8)

    // 处理 URL 编码的字符
    const decodedContent = decodeURIComponent(content)

    // 分离主体和备注
    const [mainPart = '', remark = ''] = decodedContent.split('#')

    if (!mainPart) {
      throw new Error('SOCKS链接格式错误：缺少主体部分')
    }

    // 解析主体部分: username:password@server:port
    const atIndex = mainPart.lastIndexOf('@')
    if (atIndex === -1) {
      throw new Error('SOCKS链接格式错误：缺少 @ 分隔符')
    }

    const userInfo = mainPart.substring(0, atIndex)
    const serverInfo = mainPart.substring(atIndex + 1)

    // 解析用户信息 (可能是 base64 编码或明文)
    let username = ''
    let password = ''

    try {
      // 尝试 base64 解码
      const decoded = Buffer.from(userInfo, 'base64').toString('utf-8')
      if (decoded.includes(':')) {
        const [user = '', pass = ''] = decoded.split(':')
        username = user
        password = pass
      } else {
        // 如果解码后没有冒号，可能是明文
        throw new Error('不是 base64')
      }
    } catch {
      // 明文格式
      if (userInfo.includes(':')) {
        const [user = '', pass = ''] = userInfo.split(':')
        username = user
        password = pass
      } else {
        throw new Error('SOCKS链接格式错误：用户信息格式不正确')
      }
    }

    // 解析服务器和端口
    const colonIndex = serverInfo.lastIndexOf(':')
    if (colonIndex === -1) {
      throw new Error('SOCKS链接格式错误：缺少端口')
    }

    const server = serverInfo.substring(0, colonIndex)
    const port = serverInfo.substring(colonIndex + 1)

    // 严格验证参数
    if (!server) {
      throw new Error('SOCKS链接缺少服务器地址')
    }
    if (!port) {
      throw new Error('SOCKS链接缺少端口')
    }

    // 尝试解码备注
    let decodedRemark = ''
    try {
      decodedRemark = decodeURIComponent(remark)
    } catch {
      decodedRemark = remark
    }

    // 构建节点配置
    const proxy: Proxy = {
      type: 'socks5',
      name: decodedRemark || server,
      server,
      port: parseInt(port),
      ...(username && { username }),
      ...(password && { password })
    }

    return proxy
  }

  /**
   * 转换为 Sing-box 格式
   * @param proxy SOCKS代理配置
   * @returns Sing-box出站配置
   */
  static toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
    if (proxy.type !== 'socks5') {
      return null
    }

    return {
      type: 'socks',
      tag: proxy.name,
      server: proxy.server,
      server_port: typeof proxy.port === 'number' ? proxy.port : parseInt(String(proxy.port)),
      version: '5',
      ...(proxy.username && { username: proxy.username }),
      ...(proxy.password && { password: proxy.password })
    }
  }
}

// 兼容性导出
export const parseSocks = SocksProtocol.parse
