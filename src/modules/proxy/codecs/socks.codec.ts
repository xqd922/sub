import {
  formatHostForUri,
  safeDecodeUriComponent,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  SocksProxy,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8, encodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

export function parseSocksUri(uri: string): SocksProxy {
  const content = uri.slice(8)
  const hashIndex = content.indexOf('#')
  const rawMainPart = hashIndex === -1 ? content : content.slice(0, hashIndex)
  const rawRemark = hashIndex === -1 ? '' : content.slice(hashIndex + 1)

  const mainPart = safeDecodeUriComponent(rawMainPart)
  if (!mainPart) {
    throw new Error('SOCKS链接格式错误：缺少主体部分')
  }

  let username = ''
  let password = ''
  let serverInfo = mainPart

  const atIndex = mainPart.lastIndexOf('@')
  if (atIndex !== -1) {
    const userInfo = mainPart.slice(0, atIndex)
    serverInfo = mainPart.slice(atIndex + 1)

    try {
      const decoded = decodeBase64Utf8(userInfo)
      if (decoded.includes(':')) {
        const sep = decoded.indexOf(':')
        username = decoded.slice(0, sep)
        password = decoded.slice(sep + 1)
      } else {
        throw new Error('不是 base64')
      }
    } catch {
      if (userInfo.includes(':')) {
        const sep = userInfo.indexOf(':')
        username = userInfo.slice(0, sep)
        password = userInfo.slice(sep + 1)
      } else {
        throw new Error('SOCKS链接格式错误：用户信息格式不正确')
      }
    }
  }

  let server: string
  let port: string
  const ipv6Match = serverInfo.match(/^\[(.*)\]:(\d+)$/)
  if (ipv6Match) {
    server = ipv6Match[1]
    port = ipv6Match[2]
  } else {
    const colonIndex = serverInfo.lastIndexOf(':')
    if (colonIndex === -1) {
      throw new Error('SOCKS链接格式错误：缺少端口')
    }
    server = stripIpv6Brackets(serverInfo.slice(0, colonIndex))
    port = serverInfo.slice(colonIndex + 1)
  }

  if (!server) throw new Error('SOCKS链接缺少服务器地址')
  if (!port) throw new Error('SOCKS链接缺少端口')

  const decodedRemark = rawRemark ? safeDecodeUriComponent(rawRemark) : ''

  return {
    type: 'socks5',
    name: decodedRemark || server,
    server,
    port: parsePort(port, 1080),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  }
}

export function validateSocksProxy(proxy: Proxy): boolean {
  return proxy.type === 'socks5' || proxy.type === 'socks'
}

export function socksToUri(proxy: SocksProxy): string {
  const host = formatHostForUri(proxy.server)
  const authPrefix =
    proxy.username || proxy.password
      ? `${encodeBase64Utf8(`${proxy.username || ''}:${proxy.password || ''}`)}@`
      : ''
  const suffix = proxy.name && proxy.name !== proxy.server ? `#${encodeURIComponent(proxy.name)}` : ''
  return `socks://${authPrefix}${host}:${proxy.port}${suffix}`
}

export function socksToSingboxOutbound(proxy: SocksProxy): SingboxOutbound {
  return {
    type: 'socks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 1080),
    version: '5',
    ...(proxy.username ? { username: proxy.username } : {}),
    ...(proxy.password ? { password: proxy.password } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const socksCodec: ProtocolCodec<SocksProxy> = {
  types: ['socks5', 'socks'],
  prefixes: ['socks://'],
  parse: parseSocksUri,
  validate: validateSocksProxy,
  toUri: socksToUri,
  toSingboxOutbound: socksToSingboxOutbound,
}
