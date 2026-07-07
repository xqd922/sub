export { parse as parseShadowsocks, toUri as generateShadowsocksURL } from '@/node/proto/shadowsocks'
export { parse as parseVmess } from '@/node/proto/vmess'
export { parse as parseTrojan } from '@/node/proto/trojan'
export { parse as parseVless } from '@/node/proto/vless'
export { parse as parseHysteria2 } from '@/node/proto/hysteria2'
export { parse as parseSocks } from '@/node/proto/socks'
export { parse as parseAnyTLS } from '@/node/proto/anytls'

import { Proxy } from '@/node/types'
import { toUri as ssToUri } from '@/node/proto/shadowsocks'
import { toUri as vmessToUri } from '@/node/proto/vmess'
import { toUri as trojanToUri } from '@/node/proto/trojan'
import { toUri as vlessToUri } from '@/node/proto/vless'
import { toUri as hysteria2ToUri } from '@/node/proto/hysteria2'
import { toUri as anytlsToUri } from '@/node/proto/anytls'

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

export function proxiesToUris(proxies: Proxy[]): string[] {
  return proxies.map(proxyToUri).filter((uri): uri is string => uri !== null)
}

export function generateBase64Subscription(proxies: Proxy[]): string {
  const uris = proxiesToUris(proxies)
  return Buffer.from(uris.join('\n')).toString('base64')
}