import { Proxy } from '@/node/types'
import { SingboxProxyConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'

export function parse(uri: string): Proxy {

  const content = uri.substring(8)

  const decodedContent = decodeURIComponent(content)

  const [mainPart = '', remark = ''] = decodedContent.split('#')

  if (!mainPart) {
    throw new Error('SOCKS链接格式错误：缺少主体部分')
  }

  const atIndex = mainPart.lastIndexOf('@')
  if (atIndex === -1) {
    throw new Error('SOCKS链接格式错误：缺少 @ 分隔符')
  }

  const userInfo = mainPart.substring(0, atIndex)
  const serverInfo = mainPart.substring(atIndex + 1)

  let username = ''
  let password = ''

  try {

    const decoded = Buffer.from(userInfo, 'base64').toString('utf-8')
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

  const server = serverInfo.substring(0, colonIndex)
  const port = serverInfo.substring(colonIndex + 1)

  if (!server) {
    throw new Error('SOCKS链接缺少服务器地址')
  }
  if (!port) {
    throw new Error('SOCKS链接缺少端口')
  }

  let decodedRemark = ''
  try {
    decodedRemark = decodeURIComponent(remark)
  } catch {
    decodedRemark = remark
  }

  const proxy: Proxy = {
    type: 'socks5',
    name: decodedRemark || server,
    server,
    port: parsePort(port, 1080),
    ...(username && { username }),
    ...(password && { password })
  }

  return proxy
}

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'socks5') {
    return null
  }

  return {
    type: 'socks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 1080),
    version: '5',
    ...(proxy.username && { username: proxy.username }),
    ...(proxy.password && { password: proxy.password })
  }
}

// ponytail: 兼容性导出
export const parseSocks = parse