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

function decodeRemarkFully(rawRemark: string): string {
  const once = safeDecodeUriComponent(rawRemark)
  if (/%[0-9a-fA-F]{2}/.test(once)) {
    return safeDecodeUriComponent(once)
  }
  return once
}

export function parseShadowsocksUri(uri: string): SSProxy {
  const content = uri.slice(5)
  const hashIndex = content.indexOf('#')
  const rawMainPart = hashIndex === -1 ? content : content.slice(0, hashIndex)
  const rawRemark = hashIndex === -1 ? '' : content.slice(hashIndex + 1)

  if (!rawMainPart) {
    throw new Error('SS链接格式错误：缺少主体部分')
  }

  let decoded: string
  const pluginOpts: Record<string, string> = {}

  try {
    const queryIdx = rawMainPart.indexOf('?')
    let basePart = queryIdx === -1 ? rawMainPart : rawMainPart.slice(0, queryIdx)
    const queryString = queryIdx === -1 ? '' : rawMainPart.slice(queryIdx + 1)

    if (basePart.endsWith('/')) {
      basePart = basePart.slice(0, -1)
    }

    if (queryString) {
      const params = new URLSearchParams(queryString)
      const plugin = params.get('plugin')
      if (plugin) {
        for (const param of plugin.split(';')) {
          const eqIdx = param.indexOf('=')
          if (eqIdx === -1) continue
          const key = param.slice(0, eqIdx).trim()
          const value = param.slice(eqIdx + 1).trim()
          if (key && value && (key === 'obfs' || key === 'obfs-host')) {
            pluginOpts[key] = value
          }
        }
      }
    }

    const decodedBase = safeDecodeUriComponent(basePart)
    if (decodedBase.includes('@')) {
      const separatorIndex = decodedBase.lastIndexOf('@')
      const userInfo = decodedBase.slice(0, separatorIndex)
      const serverPart = decodedBase.slice(separatorIndex + 1)
      if (!userInfo) {
        throw new Error('SS链接格式错误：缺少用户信息')
      }
      decoded = `${decodeBase64Utf8(userInfo)}@${serverPart}`
    } else {
      decoded = decodeBase64Utf8(decodedBase)
    }
  } catch (error) {
    logger.error('SS链接解析错误:', {
      uri,
      error: error instanceof Error ? error.message : error,
    })
    throw new Error('无效的 SS 链接格式：Base64 解码失败')
  }

  const atIndex = decoded.lastIndexOf('@')
  if (atIndex === -1) {
    throw new Error(`无效的 SS 链接格式：解析失败 - ${decoded}`)
  }

  const methodAndPassword = decoded.slice(0, atIndex)
  const serverAndPort = decoded.slice(atIndex + 1)
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

  const ipv6Match = serverAndPort.match(/^\[(.*)\]:(\d+)$/)
  let server: string
  let port: string
  if (ipv6Match) {
    server = ipv6Match[1] || ''
    port = ipv6Match[2] || ''
  } else {
    const lastColon = serverAndPort.lastIndexOf(':')
    server = lastColon === -1 ? '' : serverAndPort.slice(0, lastColon)
    port = lastColon === -1 ? '' : serverAndPort.slice(lastColon + 1)
  }

  if (!method) throw new Error('SS 链接缺少加密方法')
  if (!password) throw new Error('SS 链接缺少密码')
  if (!server) throw new Error('SS 链接缺少服务器地址')
  if (!port) throw new Error('SS 链接缺少端口')

  const cleanPassword = password.split('\r')[0]?.trim() || ''
  const decodedRemark = rawRemark ? decodeRemarkFully(rawRemark) : ''

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

  const obfsMode = proxy['plugin-opts']?.mode || proxy.obfs
  const obfsHost = proxy['plugin-opts']?.host || proxy['obfs-host']
  if (obfsMode) {
    const pluginParts = ['obfs-local', `obfs=${obfsMode}`]
    if (obfsHost) pluginParts.push(`obfs-host=${obfsHost}`)
    uri += `/?plugin=${encodeURIComponent(pluginParts.join(';'))}`
  }

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
