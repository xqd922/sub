import { Proxy } from '@/types'
import { logger } from '@/logger'
import {
  parse as parseShadowsocks,
  toUri as ssToUri,
  toSingboxOutbound as ssToSingboxOutbound
} from '@/parse/shadowsocks'
import { parse as parseVmess, toSingboxOutbound as vmessToSingboxOutbound } from '@/parse/vmess'
import { parse as parseTrojan, toSingboxOutbound as trojanToSingboxOutbound } from '@/parse/trojan'
import { parse as parseVless, toSingboxOutbound as vlessToSingboxOutbound } from '@/parse/vless'
import { parse as parseHysteria2, toSingboxOutbound as hysteria2ToSingboxOutbound } from '@/parse/hysteria2'
import { parse as parseSocks, toSingboxOutbound as socksToSingboxOutbound } from '@/parse/socks'
import { parse as parseAnyTLS, toSingboxOutbound as anytlsToSingboxOutbound } from '@/parse/anytls'

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
 * 解析单个节点链接
 * @param uri 节点链接字符串
 * @returns 解析后的节点配置
 */
export function parseProxyUri(uri: string): Proxy | null {
  try {
    // 检查协议类型并使用对应的协议解析器
    if (uri.startsWith('ss://')) {
      return parseShadowsocks(uri)
    } else if (uri.startsWith('vmess://')) {
      return parseVmess(uri)
    } else if (uri.startsWith('trojan://')) {
      return parseTrojan(uri)
    } else if (uri.startsWith('vless://')) {
      return parseVless(uri)
    } else if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) {
      return parseHysteria2(uri)
    } else if (uri.startsWith('socks://')) {
      return parseSocks(uri)
    } else if (uri.startsWith('anytls://')) {
      return parseAnyTLS(uri)
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
export function generateShadowsocksURL(proxy: Proxy): string {
  return ssToUri(proxy) || ''
}

/**
 * 验证节点配置的有效性
 * @param proxy 节点配置对象
 */
export function validateProxy(proxy: Proxy): boolean {
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
    case 'anytls':
      return !!(proxy.password)
    case 'socks5':
      return true
    default:
      return false
  }
}

/**
 * 将Proxy节点转换为sing-box格式
 * @param proxy 节点对象
 * @returns sing-box格式的出站配置
 */
export function proxyToSingboxOutbound(proxy: Proxy): SingboxOutbound | null {
  // 使用对应协议的转换器
  switch (proxy.type) {
    case 'ss':
      return ssToSingboxOutbound(proxy)
    case 'vmess':
      return vmessToSingboxOutbound(proxy)
    case 'trojan':
      return trojanToSingboxOutbound(proxy)
    case 'vless':
      return vlessToSingboxOutbound(proxy)
    case 'hysteria2':
      return hysteria2ToSingboxOutbound(proxy)
    case 'socks5':
      return socksToSingboxOutbound(proxy)
    case 'anytls':
      return anytlsToSingboxOutbound(proxy)
    default:
      return null
  }
}

/**
 * 解析多个节点链接
 * @param input 节点链接字符串
 * @returns 解析后的节点配置数组
 */
export function parseMultipleProxies(input: string): Proxy[] {
  // 分割多个节点链接
  const uris = input.split(/\s+/).filter(uri => uri.trim())

  // 解析每个节点
  return uris
    .map(uri => parseProxyUri(uri))
    .filter((proxy): proxy is Proxy => proxy !== null)
}
