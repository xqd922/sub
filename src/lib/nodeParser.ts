import { Proxy } from './types'
import { logger } from './logger'
import {
  SSProtocol,
  VMessProtocol,
  TrojanProtocol,
  VLessProtocol,
  Hysteria2Protocol
} from './protocols'

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
   * 解析多个节点链接
   * @param input 节点链接字符串
   * @returns 解析后的节点配置数组
   */
  static parseMultiple(input: string): Proxy[] {
    // 分割多个节点链接
    const uris = input.split(/\s+/).filter(uri => uri.trim())

    // 解析每个节点
    return uris
      .map(uri => this.parse(uri))
      .filter((proxy): proxy is Proxy => proxy !== null)
  }

  /**
   * 解析单个节点链接
   * @param uri 节点链接字符串
   * @returns 解析后的节点配置
   */
  static parse(uri: string): Proxy | null {
    try {
      // 检查协议类型并使用对应的协议解析器
      if (uri.startsWith('ss://')) {
        return SSProtocol.parse(uri)
      } else if (uri.startsWith('vmess://')) {
        return VMessProtocol.parse(uri)
      } else if (uri.startsWith('trojan://')) {
        return TrojanProtocol.parse(uri)
      } else if (uri.startsWith('vless://')) {
        return VLessProtocol.parse(uri)
      } else if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) {
        return Hysteria2Protocol.parse(uri)
      }
      throw new Error('不支持的代理协议类型，请检查链接格式')
    } catch (error) {
      logger.error('节点解析失败:', error)
      return null
    }
  }

  /**
   * 生成 SS URL
   * @param proxy SS 节点配置
   * @returns SS URL 字符串
   */
  static generateShadowsocksURL(proxy: Proxy): string {
    return SSProtocol.generateURL(proxy)
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

    // 使用对应协议的验证器
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
    // 使用对应协议的转换器
    switch (proxy.type) {
      case 'ss':
        return SSProtocol.toSingboxOutbound(proxy)
      case 'vmess':
        return VMessProtocol.toSingboxOutbound(proxy)
      case 'trojan':
        return TrojanProtocol.toSingboxOutbound(proxy)
      case 'vless':
        return VLessProtocol.toSingboxOutbound(proxy)
      case 'hysteria2':
        return Hysteria2Protocol.toSingboxOutbound(proxy)
      default:
        return null
    }
  }
}

// 兼容性导出 - 保持向后兼容
export const parseShadowsocks = SSProtocol.parse
export const parseVmess = VMessProtocol.parse
export const parseTrojan = TrojanProtocol.parse
export const parseVless = VLessProtocol.parse
export const parseHysteria2 = Hysteria2Protocol.parse
export const generateShadowsocksURL = SSProtocol.generateURL