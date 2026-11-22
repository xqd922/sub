import {
  formatHostForUri,
  parseBoolFlag,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
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
  const schemeEnd = uri.indexOf('://')
  if (schemeEnd === -1) {
    throw new Error('SOCKS链接格式错误：缺少协议头')
  }
  const scheme = uri.slice(0, schemeEnd).toLowerCase()
  const content = uri.slice(schemeEnd + 3)

  const hashIndex = content.indexOf('#')
  const rawMainPart = hashIndex === -1 ? content : content.slice(0, hashIndex)
  const rawRemark = hashIndex === -1 ? '' : content.slice(hashIndex + 1)

  const queryIndex = rawMainPart.indexOf('?')
  const hostAuthRaw = queryIndex === -1 ? rawMainPart : rawMainPart.slice(0, queryIndex)
  const queryString = queryIndex === -1 ? '' : rawMainPart.slice(queryIndex + 1)

  let mainPart = safeDecodeUriComponent(hostAuthRaw.replace(/\/+$/, ''))
  if (!mainPart) {
    throw new Error('SOCKS链接格式错误：缺少主体部分')
  }

  // 兼容 Shadowrocket 整段 Base64 编码：socks://base64(user:pass@host:port)#name
  if (!mainPart.includes(':')) {
    try {
      const decodedFull = decodeBase64Utf8(mainPart)
      if (decodedFull.includes(':')) {
        mainPart = decodedFull
      }
    } catch {
      // 维持原文
    }
  }

  let username = ''
  let password = ''
  let serverInfo = mainPart

  const atIndex = mainPart.lastIndexOf('@')
  if (atIndex !== -1) {
    const userInfo = mainPart.slice(0, atIndex)
    serverInfo = mainPart.slice(atIndex + 1)

    if (userInfo.includes(':')) {
      const sep = userInfo.indexOf(':')
      username = userInfo.slice(0, sep)
      password = userInfo.slice(sep + 1)
    } else {
      try {
        const decoded = decodeBase64Utf8(userInfo)
        if (decoded.includes(':')) {
          const sep = decoded.indexOf(':')
          username = decoded.slice(0, sep)
          password = decoded.slice(sep + 1)
        } else {
          username = decoded
        }
      } catch {
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

  const params = queryString ? new URLSearchParams(queryString) : null
  const tls = parseBoolFlag(params?.get('tls'))
  const skipCertVerify =
    parseBoolFlag(params?.get('allowInsecure')) ||
    parseBoolFlag(params?.get('insecure')) ||
    parseBoolFlag(params?.get('skip-cert-verify'))
  const udpOverTcp = parseBoolFlag(params?.get('uot')) || parseBoolFlag(params?.get('udp-over-tcp'))
  const decodedRemark = rawRemark ? safeDecodeUriComponent(rawRemark) : ''

  return {
    type: 'socks5',
    ...(scheme === 'socks4' ? { version: '4' as const } : {}),
    name: decodedRemark || server,
    server,
    port: parsePort(port, 1080),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tls ? { tls: true } : {}),
    ...(skipCertVerify ? { 'skip-cert-verify': true } : {}),
    ...(params?.get('udp') !== null && params?.get('udp') !== undefined
      ? { udp: params.get('udp') !== 'false' && params.get('udp') !== '0' }
      : {}),
    ...(udpOverTcp ? { 'udp-over-tcp': true } : {}),
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
  const params = new URLSearchParams()
  if (proxy.tls) params.set('tls', '1')
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy['udp-over-tcp']) params.set('uot', '1')
  const query = params.toString() ? `?${params.toString()}` : ''
  const suffix = proxy.name && proxy.name !== proxy.server ? `#${encodeURIComponent(proxy.name)}` : ''
  return `socks://${authPrefix}${host}:${proxy.port}${query}${suffix}`
}

export function socksToClashProxy(proxy: SocksProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  cleaned.type = 'socks5'
  delete cleaned.version
  delete cleaned['udp-over-tcp']
  return cleaned
}

export function socksToSingboxOutbound(proxy: SocksProxy): SingboxOutbound {
  return {
    type: 'socks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 1080),
    version: proxy.version ? String(proxy.version) : '5',
    ...(proxy.username ? { username: proxy.username } : {}),
    ...(proxy.password ? { password: proxy.password } : {}),
    ...(proxy.udp === false ? { network: 'tcp' } : {}),
    ...(proxy['udp-over-tcp'] ? { udp_over_tcp: { enabled: true } } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const socksCodec: ProtocolCodec<SocksProxy> = {
  types: ['socks5', 'socks'],
  prefixes: ['socks://', 'socks5://', 'socks5h://', 'socks4://'],
  parse: parseSocksUri,
  validate: validateSocksProxy,
  toUri: socksToUri,
  toClashProxy: socksToClashProxy,
  toSingboxOutbound: socksToSingboxOutbound,
}
