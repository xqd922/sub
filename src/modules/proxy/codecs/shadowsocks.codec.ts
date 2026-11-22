import {
  formatHostForUri,
  safeDecodeUriComponent,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SSProxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { logger } from '@/server/logger'
import { decodeBase64Utf8, encodeBase64UrlUtf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

export function parseShadowsocksUri(uri: string): SSProxy {
  const content = uri.slice(5)
  const decodedContent = safeDecodeUriComponent(content)
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
        for (const param of plugin.split(';')) {
          const [key, value] = param.split('=')
          if (key && value && (key === 'obfs' || key === 'obfs-host')) {
            pluginOpts[key] = value
          }
        }
      }
    }

    if (basePart.includes('@')) {
      const separatorIndex = basePart.lastIndexOf('@')
      const userInfo = basePart.slice(0, separatorIndex)
      const serverPart = basePart.slice(separatorIndex + 1)
      if (!userInfo) {
        throw new Error('SS链接格式错误：缺少用户信息')
      }
      decoded = `${decodeBase64Utf8(userInfo)}@${serverPart}`
    } else {
      decoded = decodeBase64Utf8(basePart)
    }
  } catch (error) {
    logger.error('SS链接解析错误:', {
      uri,
      error: error instanceof Error ? error.message : error,
    })
    throw new Error('无效的 SS 链接格式：Base64 解码失败')
  }

  const [methodAndPassword, serverAndPort] = decoded.split('@')
  if (!methodAndPassword || !serverAndPort) {
    throw new Error(`无效的 SS 链接格式：解析失败 - ${decoded}`)
  }

  let method: string
  let password: string
  try {
    const parts = methodAndPassword.split(':')
    if (parts.length >= 2) {
      method = parts[0] || 'aes-256-gcm'
      password = parts.slice(1).join(':')
    } else {
      const decodedParts = decodeBase64Utf8(methodAndPassword).split(':')
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
    server = ipv6Match[1] || 'localhost'
    port = ipv6Match[2] || '8080'
  } else {
    const lastColon = serverAndPort.lastIndexOf(':')
    server = serverAndPort.slice(0, lastColon)
    port = serverAndPort.slice(lastColon + 1)
  }

  if (!method) throw new Error('SS 链接缺少加密方法')
  if (!password) throw new Error('SS 链接缺少密码')
  if (!server) throw new Error('SS 链接缺少服务器地址')
  if (!port) throw new Error('SS 链接缺少端口')

  const cleanPassword = password.split('\r')[0]?.trim() || ''
  const decodedRemark = safeDecodeUriComponent(remark)

  const proxy: SSProxy = {
    type: 'ss',
    name: decodedRemark || server,
    server,
    port: parsePort(port),
    'client-fingerprint': 'chrome',
    cipher: method,
    password: cleanPassword,
  }

  if (pluginOpts.obfs) {
    proxy.plugin = 'obfs'
    proxy['plugin-opts'] = {
      mode: pluginOpts.obfs || 'http',
      ...(pluginOpts['obfs-host'] ? { host: pluginOpts['obfs-host'] } : {}),
    }
  }

  return proxy
}

export function validateShadowsocksProxy(proxy: Proxy): boolean {
  return proxy.type === 'ss' && Boolean(proxy.cipher && proxy.password)
}

export function shadowsocksToUri(proxy: SSProxy): string {
  const userInfo = `${proxy['encrypt-method'] || proxy.cipher}:${proxy.password}`
  const encodedUserInfo = encodeBase64UrlUtf8(userInfo)
  let uri = `ss://${encodedUserInfo}@${formatHostForUri(proxy.server)}:${proxy.port}`

  if (proxy.name && proxy.name !== proxy.server) {
    uri += `#${encodeURIComponent(proxy.name)}`
  }

  return uri
}

export function shadowsocksToSingboxOutbound(proxy: SSProxy): SingboxOutbound {
  return {
    type: 'shadowsocks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    method: proxy['encrypt-method'] || proxy.cipher || 'aes-256-gcm',
    password: proxy.password || '',
    ...(proxy.plugin === 'obfs' && proxy['plugin-opts']
      ? {
          plugin: 'obfs-local',
          plugin_opts: `obfs=${proxy['plugin-opts'].mode};obfs-host=${proxy['plugin-opts'].host || 'www.bing.com'}`,
        }
      : {}),
    ...(proxy.obfs
      ? {
          plugin: 'obfs-local',
          plugin_opts: `obfs=${proxy.obfs};obfs-host=${proxy['obfs-host'] || 'www.bing.com'}`,
        }
      : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const shadowsocksCodec: ProtocolCodec<SSProxy> = {
  types: ['ss'],
  prefixes: ['ss://'],
  parse: parseShadowsocksUri,
  validate: validateShadowsocksProxy,
  toUri: shadowsocksToUri,
  toSingboxOutbound: shadowsocksToSingboxOutbound,
}
