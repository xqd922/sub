// 协议解析器统一导出
export { SSProtocol, parseShadowsocks, generateShadowsocksURL } from './shadowsocks'
export { VMessProtocol, parseVmess } from './vmess'
export { TrojanProtocol, parseTrojan } from './trojan'
export { VLessProtocol, parseVless } from './vless'
export { Hysteria2Protocol, parseHysteria2 } from './hysteria2'
export { SocksProtocol, parseSocks } from './socks'
export { AnyTLSProtocol, parseAnyTLS } from './anytls'

import { Proxy } from '../../core/types'
import { SSProtocol } from './shadowsocks'
import { VMessProtocol } from './vmess'
import { TrojanProtocol } from './trojan'
import { VLessProtocol } from './vless'
import { Hysteria2Protocol } from './hysteria2'
import { AnyTLSProtocol } from './anytls'

/**
 * 统一的 Proxy 转 URI 接口
 * 根据代理类型自动选择对应的转换方法
 */
export function proxyToUri(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss':
      return SSProtocol.generateURL(proxy)
    case 'vmess':
      return VMessProtocol.toUri(proxy)
    case 'trojan':
      return TrojanProtocol.toUri(proxy)
    case 'vless':
      return VLessProtocol.toUri(proxy)
    case 'hysteria2':
      return Hysteria2Protocol.toUri(proxy)
    case 'anytls':
      return AnyTLSProtocol.toUri(proxy)
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