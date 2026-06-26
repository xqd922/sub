// 协议解析器统一导出
export { parse as parseShadowsocks, toUri as generateShadowsocksURL } from '@/parse/shadowsocks'
export { parse as parseVmess } from '@/parse/vmess'
export { parse as parseTrojan } from '@/parse/trojan'
export { parse as parseVless } from '@/parse/vless'
export { parse as parseHysteria2 } from '@/parse/hysteria2'
export { parse as parseSocks } from '@/parse/socks'
export { parse as parseAnyTLS } from '@/parse/anytls'

import { Proxy } from '@/types'
import { toUri as ssToUri } from '@/parse/shadowsocks'
import { toUri as vmessToUri } from '@/parse/vmess'
import { toUri as trojanToUri } from '@/parse/trojan'
import { toUri as vlessToUri } from '@/parse/vless'
import { toUri as hysteria2ToUri } from '@/parse/hysteria2'
import { toUri as anytlsToUri } from '@/parse/anytls'

/**
 * 统一的 Proxy 转 URI 接口
 * 根据代理类型自动选择对应的转换方法
 */
export function proxyToUri(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss':
      return ssToUri(proxy)
    case 'vmess':
      return vmessToUri(proxy)
    case 'trojan':
      return trojanToUri(proxy)
    case 'vless':
      return vlessToUri(proxy)
    case 'hysteria2':
      return hysteria2ToUri(proxy)
    case 'anytls':
      return anytlsToUri(proxy)
    default:
      return null
  }
}

/**
 * 批量转换为 URI 列表
 */
export function proxiesToUris(proxies: Proxy[]): string[] {
  return proxies.map(proxyToUri).filter((uri): uri is string => uri !== null)
}

/**
 * 生成 v2rayNG/通用订阅格式 (base64 编码的 URI 列表)
 */
export function generateBase64Subscription(proxies: Proxy[]): string {
  const uris = proxiesToUris(proxies)
  return Buffer.from(uris.join('\n')).toString('base64')
}
