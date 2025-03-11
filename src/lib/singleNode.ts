import { Proxy } from './types'

/**
 * 单节点解析器
 */
export class SingleNodeParser {
  /**
   * 解析单个节点链接
   * @param uri 节点链接字符串
   * @returns 解析后的节点配置
   */
  static parse(uri: string): Proxy | null {
    try {
      // 检查协议类型
      if (uri.startsWith('ss://')) {
        return this.parseShadowsocks(uri)
      } else if (uri.startsWith('vmess://')) {
        return this.parseVmess(uri)
      } else if (uri.startsWith('trojan://')) {
        return this.parseTrojan(uri)
      } else if (uri.startsWith('vless://')) {
        return this.parseVless(uri)
      }
      throw new Error('不支持的协议类型')
    } catch (error) {
      console.error('节点解析失败:', error)
      return null
    }
  }

  /**
   * 解析 Shadowsocks 节点
   * @param uri ss://开头的节点链接
   */
  private static parseShadowsocks(uri: string): Proxy {
    // 移除 ss:// 前缀
    const content = uri.substring(5)
    
    // 分离主体和备注
    const [mainPart, remark = ''] = content.split('#')
    
    // 解析主体部分
    let decoded: string
    try {
      // 检查是否包含 @ 符号
      if (mainPart.includes('@')) {
        // 新格式: userInfo@server:port
        const [userInfo, serverPart] = mainPart.split('@')
        const decodedUserInfo = Buffer.from(userInfo, 'base64').toString()
        decoded = `${decodedUserInfo}@${serverPart}`
      } else {
        // 旧格式: 整个字符串都是 base64
        decoded = Buffer.from(mainPart, 'base64').toString()
      }
    } catch (error) {
      console.error('Base64 解码失败:', error)
      throw new Error('无效的 SS 链接格式')
    }
    
    // 解析服务器信息
    const [methodAndPassword, serverAndPort] = decoded.split('@')
    if (!methodAndPassword || !serverAndPort) {
      throw new Error('无效的 SS 链接格式')
    }

    const [method, password] = methodAndPassword.split(':')
    const [server, port] = serverAndPort.split(':')
    
    if (!method || !password || !server || !port) {
      throw new Error('SS 链接缺少必要参数')
    }

    return {
      type: 'ss',
      name: decodeURIComponent(remark) || `${server}:${port}`,
      server,
      port: parseInt(port),
      cipher: method,
      password,
      udp: true
    }
  }

  /**
   * 解析 VMess 节点
   * @param uri vmess://开头的节点链接
   */
  private static parseVmess(uri: string): Proxy {
    const content = uri.substring(8)
    const config = JSON.parse(Buffer.from(content, 'base64').toString())
    
    return {
      type: 'vmess',
      name: config.ps || `${config.add}:${config.port}`,
      server: config.add,
      port: parseInt(config.port),
      uuid: config.id,
      alterId: parseInt(config.aid) || 0,
      cipher: 'auto',
      network: config.net || 'tcp',
      tls: config.tls === 'tls',
      wsPath: config.path || '',
      wsHeaders: config.host ? { Host: config.host } : undefined
    }
  }

  /**
   * 解析 Trojan 节点
   * @param uri trojan://开头的节点链接
   */
  private static parseTrojan(uri: string): Proxy {
    const url = new URL(uri)
    
    return {
      type: 'trojan',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
      server: url.hostname,
      port: parseInt(url.port),
      password: url.username,
      sni: url.searchParams.get('sni') || url.hostname,
      udp: true,
      skipCertVerify: url.searchParams.get('allowInsecure') === '1'
    }
  }

  /**
   * 解析 VLESS 节点
   * @param uri vless://开头的节点链接
   */
  private static parseVless(uri: string): Proxy {
    const url = new URL(uri)
    
    return {
      type: 'vless',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
      server: url.hostname,
      port: parseInt(url.port),
      uuid: url.username,
      network: url.searchParams.get('type') || 'tcp',
      tls: url.searchParams.get('security') === 'tls',
      flow: url.searchParams.get('flow') || '',
      sni: url.searchParams.get('sni') || url.hostname,
      udp: true
    }
  }

  /**
   * 验证节点配置的有效性
   * @param proxy 节点配置对象
   */
  static validate(proxy: Proxy): boolean {
    // 基本字段验证
    if (!proxy.server || !proxy.port || !proxy.type) {
      return false
    }

    // 端口范围验证
    if (proxy.port < 1 || proxy.port > 65535) {
      return false
    }

    // 协议特定验证
    switch (proxy.type) {
      case 'ss':
        return !!(proxy.cipher && proxy.password)
      case 'vmess':
        return !!(proxy.uuid)
      case 'trojan':
        return !!(proxy.password)
      case 'vless':
        return !!(proxy.uuid)
      default:
        return false
    }
  }
} 