import { Proxy } from '@/node/types'
import { SingboxProxyConfig } from '@/config/types'
import { parsePort } from '@/lib/utils'
import { logger } from '@/lib/logger'

export function parse(uri: string): Proxy {

  const content = uri.substring(5)

  const decodedContent = decodeURIComponent(content)

  const [mainPart = '', remark = ''] = decodedContent.split('#')

  if (!mainPart) {
    throw new Error('SS链接格式错误：缺少主体部分')
  }

  let decoded: string
  const pluginOpts: Record<string, string> = {}

  try {

    const [basePart = '', queryString] = mainPart.split('/?')

    if (queryString) {
      const params = new URLSearchParams(queryString)
      const plugin = params.get('plugin')
      if (plugin) {

        const pluginParams = plugin.split(';')
        pluginParams.forEach(param => {
          const [key, value] = param.split('=')
          if (key && value) {
            if (key === 'obfs') {
              pluginOpts['obfs'] = value
            } else if (key === 'obfs-host') {
              pluginOpts['obfs-host'] = value
            }
          }
        })
      }
    }

    const standardBase64 = basePart
      .replace(/-/g, '+')   
      .replace(/_/g, '/')   

    const paddedBase64 = standardBase64 +
      '=='.slice(0, (4 - standardBase64.length % 4) % 4)

    if (basePart.includes('@')) {

      const [userInfo = '', serverPart] = paddedBase64.split('@')
      if (!userInfo) {
        throw new Error('SS链接格式错误：缺少用户信息')
      }
      const decodedUserInfo = Buffer.from(userInfo, 'base64').toString('utf-8')
      decoded = `${decodedUserInfo}@${serverPart}`
    } else {

      decoded = Buffer.from(paddedBase64, 'base64').toString('utf-8')
    }
  } catch (error) {
    logger.error('SS链接解析错误:', {
      uri,
      error: error instanceof Error ? error.message : error
    })
    throw new Error('无效的 SS 链接格式：Base64 解码失败')
  }

  const [methodAndPassword, serverAndPort] = decoded.split('@')
  if (!methodAndPassword || !serverAndPort) {
    throw new Error(`无效的 SS 链接格式：解析失败 - ${decoded}`)
  }

  let method: string, password: string
  try {

    const parts = methodAndPassword.split(':')

    if (parts.length === 2) {

      method = parts[0] || 'aes-256-gcm'
      password = parts[1] || ''
    } else if (parts.length > 2) {

      method = parts[0] || 'aes-256-gcm'

      password = parts.slice(1).join(':')
    } else {

      const decodedParts = Buffer.from(methodAndPassword, 'base64').toString('utf-8').split(':')

      if (decodedParts.length >= 2) {
        method = 'chacha20-ietf-poly1305'
        password = decodedParts.join(':')
      } else {
        throw new Error('无法解析')
      }
    }
  } catch {

    method = 'chacha20-ietf-poly1305'
    password = methodAndPassword
  }

  const ipv6Match = serverAndPort.match(/\[(.*)\]:(\d+)/)
  let server: string
  let port: string

  if (ipv6Match) {

    const [, ipv6Server, ipv6Port] = ipv6Match
    server = ipv6Server || 'localhost'
    port = ipv6Port || '8080'
  } else {

    const lastColon = serverAndPort.lastIndexOf(':')
    server = serverAndPort.substring(0, lastColon)
    port = serverAndPort.substring(lastColon + 1)
  }

  if (!method) {
    throw new Error('SS 链接缺少加密方法')
  }
  if (!password) {
    throw new Error('SS 链接缺少密码')
  }
  if (!server) {
    throw new Error('SS 链接缺少服务器地址')
  }
  if (!port) {
    throw new Error('SS 链接缺少端口')
  }

  const cleanPassword = (password || '').split('\r')[0]?.trim() || '';

  let decodedRemark = ''
  try {
    decodedRemark = decodeURIComponent(remark)
  } catch {
    decodedRemark = remark
  }

  const proxy: Proxy = {
    type: 'ss',
    name: decodedRemark || server,
    server,
    port: parsePort(port),
    'client-fingerprint': 'chrome',
    cipher: method,
    password: cleanPassword
  }

  if (pluginOpts['obfs']) {
    proxy.plugin = 'obfs'
    proxy['plugin-opts'] = {
      mode: pluginOpts['obfs'] || 'http',
      ...(pluginOpts['obfs-host'] && { host: pluginOpts['obfs-host'] })
    }
  }

  return proxy
}

export function toUri(proxy: Proxy): string | null {
  if (proxy.type !== 'ss') return null

  const userInfo = `${proxy['encrypt-method'] || proxy.cipher}:${proxy.password}`;
  const baseInfo = `${proxy.server}:${proxy.port}`;

  const base64UserInfo = Buffer.from(userInfo).toString('base64');

  let url = `ss://${base64UserInfo}@${baseInfo}`;

  if (proxy.name && proxy.name !== proxy.server) {
    url += `#${encodeURIComponent(proxy.name)}`;
  }

  return url;
}

// ponytail: 别名，兼容旧调用
export const generateURL = toUri

export function toSingboxOutbound(proxy: Proxy): SingboxProxyConfig | null {
  if (proxy.type !== 'ss') {
    return null;
  }

  return {
    type: 'shadowsocks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    method: proxy['encrypt-method'] || proxy.cipher || 'aes-256-gcm',
    password: proxy.password || '',

    ...(proxy.plugin === 'obfs' && proxy['plugin-opts'] && {
      plugin: "obfs-local",
      plugin_opts: `obfs=${proxy['plugin-opts'].mode};obfs-host=${proxy['plugin-opts'].host || 'www.bing.com'}`
    }),

    ...(proxy.obfs && {
      plugin: "obfs-local",
      plugin_opts: `obfs=${proxy.obfs};obfs-host=${proxy['obfs-host'] || 'www.bing.com'}`
    }),

    ...(proxy.detour && {
      detour: proxy.detour
    })
  }
}

// ponytail: 兼容性导出
export const parseShadowsocks = parse
export const generateShadowsocksURL = toUri