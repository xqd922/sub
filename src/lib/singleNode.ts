import { Proxy } from './types'
import { REGION_MAP } from '@/config/regions'

// 在每次请求开始时重置计数器
const counters: Record<string, number> = {}

/**
 * 单节点解析器
 */
export class SingleNodeParser {
  /**
   * 解析多个节点链接
   * @param uris 节点链接字符串数组
   * @returns 解析后的节点配置数组
   */
  static parseMultiple(input: string): Proxy[] {
    // 重置计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })

    // 分割多个节点链接
    const uris = input.split(/\s+/).filter(uri => uri.trim())
    
    // 解析每个节点
    const proxies = uris
      .map(uri => this.parse(uri))
      .filter((proxy): proxy is Proxy => proxy !== null)

    return proxies
  }

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
   * 格式化节点名称
   * @param name 节点原始名称
   */
  private static formatProxyName(proxy: Proxy): string {
    // 只从原始节点名称中提取地区信息
    const regionMatch = Object.keys(REGION_MAP).find(key => 
      proxy.name.toLowerCase().includes(key.toLowerCase())
    )
    
    if (!regionMatch) {
      return proxy.name
    }
    
    const { flag, name } = REGION_MAP[regionMatch as keyof typeof REGION_MAP]
    
    // 提取倍率信息
    const multiplierMatch = proxy.name.match(/(\d+\.?\d*)[xX倍]/)
    const multiplier = multiplierMatch ? ` | ${multiplierMatch[1]}x` : ''
    
    // 初始化计数器
    counters[name] = counters[name] || 0
    const num = String(++counters[name]).padStart(2, '0')
    
    return `${flag} ${name} ${num}${multiplier}`.trim()
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

    const proxy = {
      type: 'ss',
      name: decodeURIComponent(remark) || server,
      server,
      port: parseInt(port),
      cipher: method,
      password,
      udp: true
    }

    proxy.name = this.formatProxyName(proxy)
    return proxy
  }

  /**
   * 解析 VMess 节点
   * @param uri vmess://开头的节点链接
   */
  private static parseVmess(uri: string): Proxy {
    const content = uri.substring(8)
    const config = JSON.parse(Buffer.from(content, 'base64').toString())
    
    const proxy = {
      type: 'vmess',
      name: this.formatProxyName({
        type: 'vmess',
        name: config.ps || config.add,
        server: config.add,
        port: parseInt(config.port),
        uuid: config.id,
        alterId: parseInt(config.aid) || 0,
        cipher: 'auto',
        network: config.net || 'tcp',
        tls: config.tls === 'tls',
        wsPath: config.path || '',
        wsHeaders: config.host ? { Host: config.host } : undefined
      }),
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

    return proxy
  }

  /**
   * 解析 Trojan 节点
   * @param uri trojan://开头的节点链接
   */
  private static parseTrojan(uri: string): Proxy {
    const url = new URL(uri)
    
    const proxy = {
      type: 'trojan',
      name: this.formatProxyName({
        type: 'trojan',
        name: url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname,
        server: url.hostname,
        port: parseInt(url.port),
        password: url.username,
        sni: url.searchParams.get('sni') || url.hostname,
        udp: true,
        skipCertVerify: url.searchParams.get('allowInsecure') === '1'
      }),
      server: url.hostname,
      port: parseInt(url.port),
      password: url.username,
      sni: url.searchParams.get('sni') || url.hostname,
      udp: true,
      skipCertVerify: url.searchParams.get('allowInsecure') === '1'
    }

    return proxy
  }

  /**
   * 解析 VLESS 节点
   * @param uri vless://开头的节点链接
   */
  private static parseVless(uri: string): Proxy {
    const url = new URL(uri)
    
    const proxy = {
      type: 'vless',
      name: this.formatProxyName({
        type: 'vless',
        name: url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname,
        server: url.hostname,
        port: parseInt(url.port),
        uuid: url.username,
        network: url.searchParams.get('type') || 'tcp',
        tls: url.searchParams.get('security') === 'tls',
        flow: url.searchParams.get('flow') || '',
        sni: url.searchParams.get('sni') || url.hostname,
        udp: true
      }),
      server: url.hostname,
      port: parseInt(url.port),
      uuid: url.username,
      network: url.searchParams.get('type') || 'tcp',
      tls: url.searchParams.get('security') === 'tls',
      flow: url.searchParams.get('flow') || '',
      sni: url.searchParams.get('sni') || url.hostname,
      udp: true
    }

    return proxy
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