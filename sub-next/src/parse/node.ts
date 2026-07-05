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

interface SingboxOutbound {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  [key: string]: unknown;
}

export function parseProxyUri(uri: string): Proxy | null {
  try {

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

export function generateShadowsocksURL(proxy: Proxy): string {
  return ssToUri(proxy) || ''
}

export function validateProxy(proxy: Proxy): boolean {

  if (!proxy.server || !proxy.port || !proxy.type) {
    return false
  }

  if (proxy.port < 1 || proxy.port > 65535) {
    return false
  }

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

export function proxyToSingboxOutbound(proxy: Proxy): SingboxOutbound | null {

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

export function parseMultipleProxies(input: string): Proxy[] {

  const uris = input.split(/\s+/).filter(uri => uri.trim())

  return uris
    .map(uri => parseProxyUri(uri))
    .filter((proxy): proxy is Proxy => proxy !== null)
}