import { Proxy } from './types'
import { REGION_MAP } from '@/config/regions'

// 在每次请求开始时重置计数器
const counters: Record<string, number> = {}

/**
 * 单节点解析器
 */
export class SingleNodeParser {
  /**
   * 按地区对节点进行排序
   * @param proxies 节点数组
   * @returns 排序后的节点数组
   */
  private static sortProxiesByRegion(proxies: Proxy[]): Proxy[] {
    // 创建地区优先级映射
    const regionPriority: { [key: string]: number } = {
      '香港': 1,
      '台湾': 2,
      '日本': 3,
      '新加坡': 4,
      '美国': 5,
      // 可以添加更多地区优先级...
    }

    // 重置计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })

    return proxies
      // 按地区分组并排序
      .sort((a, b) => {
        const regionA = Object.keys(REGION_MAP).find(key => 
          a.name.toLowerCase().includes(key.toLowerCase())
        )
        const regionB = Object.keys(REGION_MAP).find(key => 
          b.name.toLowerCase().includes(key.toLowerCase())
        )

        const priorityA = regionA ? regionPriority[REGION_MAP[regionA as keyof typeof REGION_MAP].name] || 999 : 999
        const priorityB = regionB ? regionPriority[REGION_MAP[regionB as keyof typeof REGION_MAP].name] || 999 : 999

        return priorityA - priorityB
      })
      // 重新格式化名称以确保编号连续
      .map(proxy => ({
        ...proxy,
        name: this.formatProxyName(proxy)
      }))
  }

  /**
   * 解析多个节点链接
   * @param uris 节点链接字符串数组
   * @returns 解析后的节点配置数组
   */
  static parseMultiple(input: string): Proxy[] {
    // 分割多个节点链接
    const uris = input.split(/\s+/).filter(uri => uri.trim())
    
    // 解析每个节点
    const proxies = uris
      .map(uri => this.parse(uri))
      .filter((proxy): proxy is Proxy => proxy !== null)

    // 对节点进行排序
    return this.sortProxiesByRegion(proxies)
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

    // 处理 IPv6 地址
    const ipv6Match = serverAndPort.match(/\[(.*)\]:(\d+)/)
    let server: string
    let port: string

    if (ipv6Match) {
      // IPv6 格式
      [, server, port] = ipv6Match
    } else {
      // IPv4 或域名格式
      const lastColon = serverAndPort.lastIndexOf(':')
      server = serverAndPort.substring(0, lastColon)
      port = serverAndPort.substring(lastColon + 1)
    }
    
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
    const host = url.searchParams.get('host')
    
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
        udp: true
      }),
      server: url.hostname,
      port: parseInt(url.port),
      uuid: url.username,
      tls: url.searchParams.get('security') === 'tls',
      network: url.searchParams.get('type') || 'tcp',
      'client-fingerprint': url.searchParams.get('fp') || 'chrome',
      'skip-cert-verify': false,
      tfo: false,
      'ws-opts': {
        path: url.searchParams.get('path') || '',
        headers: {
          Host: host || url.hostname
        }
      }
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