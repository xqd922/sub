import { Proxy } from './types'
import { REGION_MAP } from '@/config/regions'

/**
 * sing-box出站配置接口
 */
interface SingboxOutbound {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  [key: string]: unknown;
}

/**
 * 单节点解析器
 */
export class SingleNodeParser {
  /**
   * 按地区对节点进行排序
   * @param proxies 节点数组
   * @returns 排序后的节点数组
   */
  public static sortProxiesByRegion(proxies: Proxy[]): Proxy[] {
    // 创建地区优先级映射
    const regionPriority: { [key: string]: number } = {
      'HK': 1,
      'TW': 2,
      'JP': 3,
      'SG': 4,
      'US': 5,
      // 可以添加更多地区优先级...
    }

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

    // 对节点进行排序但不重命名
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
      } else if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) {
        return this.parseHysteria2(uri)
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
  public static parseShadowsocks(uri: string): Proxy {
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

    // 清理密码中 \r 及之后的所有内容
    const cleanPassword = password.split('\r')[0];

    return {
      type: 'ss',
      name: decodeURIComponent(remark) || server,
      server,
      port: parseInt(port),
      cipher: method,
      password: cleanPassword,
      udp: true
    }
  }

  /**
   * 解析 VMess 节点
   * @param uri vmess://开头的节点链接
   */
  public static parseVmess(uri: string): Proxy {
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
   * 解析 Trojan 节点
   * @param uri trojan://开头的节点链接
   */
  public static parseTrojan(uri: string): Proxy {
    const url = new URL(uri)
    
    return {
      type: 'trojan',
      name: url.hash ? decodeURIComponent(url.hash.slice(1)) : url.hostname,
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
  public static parseVless(uri: string): Proxy {
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
   * 解析 Hysteria2 节点
   * @param uri hysteria2://开头的节点链接
   */
  public static parseHysteria2(uri: string): Proxy {
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
      case 'hysteria2':
        return !!(proxy.password)
      default:
        return false
    }
  }

  /**
   * 将Proxy节点转换为sing-box格式
   * @param proxy 节点对象
   * @returns sing-box格式的出站配置
   */
  public static toSingboxOutbound(proxy: Proxy): SingboxOutbound | null {
    switch (proxy.type) {
      case 'ss':
        return {
          type: 'shadowsocks',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          method: proxy.cipher,
          password: proxy.password
        }
      case 'vmess':
        return {
          type: 'vmess',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          security: proxy.cipher || 'auto',
          alter_id: proxy.alterId || 0,
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.server,
            insecure: true
          } : undefined,
          ...(proxy.network && proxy.network !== 'tcp' ? {
            transport: {
              type: proxy.network,
              path: proxy['ws-opts']?.path || proxy.wsPath || '',
              headers: proxy['ws-opts']?.headers || proxy.wsHeaders || undefined
            }
          } : {})
        }
      case 'trojan':
        return {
          type: 'trojan',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          password: proxy.password,
          tls: {
            enabled: true,
            server_name: proxy.sni || proxy.server,
            insecure: true
          }
        }
      case 'hysteria2':
        return {
          type: 'hysteria2',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          password: proxy.password,
          tls: {
            enabled: true,
            server_name: proxy.sni || proxy.server,
            insecure: true
          }
        }
      case 'vless':
        const realityOpts = proxy['reality-opts'];
        return {
          type: 'vless',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          flow: proxy.flow || '',
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.sni || proxy.server,
            insecure: true,
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
          } : undefined,
          transport: proxy.network && proxy.network !== 'tcp' ? {
            type: proxy.network,
            ...(proxy.network === 'ws' ? {
              path: proxy['ws-opts']?.path || '',
              headers: proxy['ws-opts']?.headers || {}
            } : {})
          } : undefined,
          packet_encoding: 'xudp'
        }
      default:
        return null
    }
  }
} 