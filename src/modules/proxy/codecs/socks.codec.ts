import { safeDecodeUriComponent } from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  SocksProxy,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8 } from '@/shared/utils/base64.utils'
import { parsePort } from '@/shared/utils/url.utils'

export function parseSocksUri(uri: string): SocksProxy {
  const content = uri.slice(8)
  const decodedContent = safeDecodeUriComponent(content)
  const [mainPart = '', remark = ''] = decodedContent.split('#')

  if (!mainPart) {
    throw new Error('SOCKS链接格式错误：缺少主体部分')
  }

  const atIndex = mainPart.lastIndexOf('@')
  if (atIndex === -1) {
    throw new Error('SOCKS链接格式错误：缺少 @ 分隔符')
  }

  const userInfo = mainPart.slice(0, atIndex)
  const serverInfo = mainPart.slice(atIndex + 1)

  let username = ''
  let password = ''

  try {
    const decoded = decodeBase64Utf8(userInfo)
    if (decoded.includes(':')) {
      const [user = '', pass = ''] = decoded.split(':')
      username = user
      password = pass
    } else {
      throw new Error('不是 base64')
    }
  } catch {
    if (userInfo.includes(':')) {
      const [user = '', pass = ''] = userInfo.split(':')
      username = user
      password = pass
    } else {
      throw new Error('SOCKS链接格式错误：用户信息格式不正确')
    }
  }

  const colonIndex = serverInfo.lastIndexOf(':')
  if (colonIndex === -1) {
    throw new Error('SOCKS链接格式错误：缺少端口')
  }

  const server = serverInfo.slice(0, colonIndex)
  const port = serverInfo.slice(colonIndex + 1)

  if (!server) throw new Error('SOCKS链接缺少服务器地址')
  if (!port) throw new Error('SOCKS链接缺少端口')

  const decodedRemark = safeDecodeUriComponent(remark)

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

export function socksToSingboxOutbound(proxy: SocksProxy): SingboxOutbound | null {
  if (proxy.type !== 'socks5') {
    return null
  }

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
  toSingboxOutbound: socksToSingboxOutbound,
}
