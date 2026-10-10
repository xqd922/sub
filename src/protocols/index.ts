import { Proxy } from '@/protocols/model'
import { logger } from '@/infra/logger'

import {
  parse as parseShadowsocks,
  toUri as ssToUri,
  toSingboxOutbound as ssToSingboxOutbound,
} from '@/protocols/shadowsocks'
import { parse as parseVmess, toUri as vmessToUri, toSingboxOutbound as vmessToSingboxOutbound } from '@/protocols/vmess'
import { parse as parseTrojan, toUri as trojanToUri, toSingboxOutbound as trojanToSingboxOutbound } from '@/protocols/trojan'
import { parse as parseVless, toUri as vlessToUri, toSingboxOutbound as vlessToSingboxOutbound } from '@/protocols/vless'
import { parse as parseHysteria2, toUri as hysteria2ToUri, toSingboxOutbound as hysteria2ToSingboxOutbound } from '@/protocols/hysteria2'
import { parse as parseSocks, toSingboxOutbound as socksToSingboxOutbound } from '@/protocols/socks'
import { parse as parseAnyTLS, toUri as anytlsToUri, toSingboxOutbound as anytlsToSingboxOutbound } from '@/protocols/anytls'
import { parse as parseSnell, toSingboxOutbound as snellToSingboxOutbound } from '@/protocols/snell'

interface SingboxOutbound {
  type: string
  tag: string
  server: string
  server_port: number
  [key: string]: unknown
}

// Uri-based parsing ---------------------------------------------

export function parseProxyUri(uri: string): Proxy | null {
  try {
    if (uri.startsWith('ss://')) return parseShadowsocks(uri)
    if (uri.startsWith('vmess://')) return parseVmess(uri)
    if (uri.startsWith('trojan://')) return parseTrojan(uri)
    if (uri.startsWith('vless://')) return parseVless(uri)
    if (uri.startsWith('hysteria2://') || uri.startsWith('hy2://')) return parseHysteria2(uri)
    if (uri.startsWith('socks://')) return parseSocks(uri)
    if (uri.startsWith('anytls://')) return parseAnyTLS(uri)
    if (uri.startsWith('snell://')) return parseSnell(uri)
    throw new Error('不支持的代理协议类型，请检查链接格式')
  } catch (error) {
    logger.error('节点解析失败:', error)
    return null
  }
}

export function parseMultipleProxies(input: string): Proxy[] {
  return input
    .split(/\s+/)
    .filter(uri => uri.trim())
    .map(parseProxyUri)
    .filter((proxy): proxy is Proxy => proxy !== null)
}

export function validateProxy(proxy: Proxy): boolean {
  if (!proxy.server || !proxy.port || !proxy.type) return false
  if (proxy.port < 1 || proxy.port > 65535) return false

  switch (proxy.type) {
    case 'ss': return !!(proxy.cipher && proxy.password)
    case 'vmess': return !!(proxy.uuid)
    case 'trojan': return !!(proxy.password)
    case 'vless': return !!(proxy.uuid)
    case 'hysteria2': return !!(proxy.password)
    case 'anytls': return !!(proxy.password)
    case 'snell': return !!(proxy.psk)
    case 'socks5': return true
    default: return false
  }
}

// Uri-based serialization ----------------------------------------

export function proxyToUri(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss': return ssToUri(proxy)
    case 'vmess': return vmessToUri(proxy)
    case 'trojan': return trojanToUri(proxy)
    case 'vless': return vlessToUri(proxy)
    case 'hysteria2': return hysteria2ToUri(proxy)
    case 'anytls': return anytlsToUri(proxy)
    default: return null
  }
}

export function proxiesToUris(proxies: Proxy[]): string[] {
  return proxies.map(proxyToUri).filter((uri): uri is string => uri !== null)
}

export function generateBase64Subscription(proxies: Proxy[]): string {
  const uris = proxiesToUris(proxies)
  return Buffer.from(uris.join('\n')).toString('base64')
}

// Sing-box conversion --------------------------------------------

export function proxyToSingboxOutbound(proxy: Proxy): SingboxOutbound | null {
  switch (proxy.type) {
    case 'ss': return ssToSingboxOutbound(proxy)
    case 'vmess': return vmessToSingboxOutbound(proxy)
    case 'trojan': return trojanToSingboxOutbound(proxy)
    case 'vless': return vlessToSingboxOutbound(proxy)
    case 'hysteria2': return hysteria2ToSingboxOutbound(proxy)
    case 'socks5': return socksToSingboxOutbound(proxy)
    case 'anytls': return anytlsToSingboxOutbound(proxy)
    case 'snell': return snellToSingboxOutbound(proxy)
    default: return null
  }
}

export function generateShadowsocksURL(proxy: Proxy): string {
  return ssToUri(proxy) || ''
}
