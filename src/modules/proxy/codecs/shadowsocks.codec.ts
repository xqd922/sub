import {
  buildShadowTlsSingboxOutbound,
  buildSingboxMultiplex,
  formatHostForUri,
  normalizeAlpnList,
  parseBoolFlag,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SSProxy,
  ShadowTlsOptions,
  SingboxConversionBundle,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { logger } from '@/server/logger'
import { decodeBase64Utf8, encodeBase64UrlUtf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

const KNOWN_SS_CIPHERS = new Set([
  'aes-128-gcm',
  'aes-192-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  'xchacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-chacha20-poly1305',
  'aes-128-ctr',
  'aes-192-ctr',
  'aes-256-ctr',
  'aes-128-cfb',
  'aes-192-cfb',
  'aes-256-cfb',
  'rc4-md5',
  'chacha20-ietf',
  'xchacha20',
  'none',
  'plain',
])

function decodeRemarkFully(rawRemark: string): string {
  const once = safeDecodeUriComponent(rawRemark)
  if (/%[0-9a-fA-F]{2}/.test(once)) {
    return safeDecodeUriComponent(once)
  }
  return once
}

function parseSip002Plugin(pluginRaw: string): {
  plugin?: string
  pluginOpts?: NonNullable<SSProxy['plugin-opts']>
} {
  const segments = pluginRaw.split(';').map((s) => s.trim()).filter(Boolean)
  if (segments.length === 0) return {}

  const rawName = segments[0].toLowerCase()
  const kv: Record<string, string> = {}
  const flags = new Set<string>()

  for (const part of segments.slice(1)) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) {
      flags.add(part.toLowerCase())
    } else {
      const k = part.slice(0, eqIdx).trim()
      const v = part.slice(eqIdx + 1).trim()
      if (k) kv[k] = v
    }
  }

  if (rawName.includes('obfs')) {
    return {
      plugin: 'obfs',
      pluginOpts: {
        mode: kv.obfs || kv.mode || 'http',
        ...(kv['obfs-host'] || kv.host ? { host: kv['obfs-host'] || kv.host } : {}),
      },
    }
  }

  if (rawName.includes('v2ray-plugin')) {
    return {
      plugin: 'v2ray-plugin',
      pluginOpts: {
        mode: kv.mode || kv.obfs || 'websocket',
        ...(kv.host || kv['obfs-host'] ? { host: kv.host || kv['obfs-host'] } : {}),
        ...(kv.path ? { path: kv.path } : {}),
        ...(flags.has('tls') || parseBoolFlag(kv.tls) ? { tls: true } : {}),
        ...(flags.has('mux') || parseBoolFlag(kv.mux) ? { mux: true } : {}),
        ...(parseBoolFlag(kv['skip-cert-verify']) ? { 'skip-cert-verify': true } : {}),
      },
    }
  }

  if (rawName.includes('shadow-tls')) {
    return {
      plugin: 'shadow-tls',
      pluginOpts: {
        ...(kv.host || kv.sni ? { host: kv.host || kv.sni } : {}),
        ...(kv.password ? { password: kv.password } : {}),
        ...(kv.version ? { version: parseInt(kv.version, 10) || 3 } : {}),
        ...(kv.fingerprint ? { fingerprint: kv.fingerprint } : {}),
        ...(parseBoolFlag(kv['skip-cert-verify']) ? { 'skip-cert-verify': true } : {}),
        ...(kv.alpn ? { alpn: normalizeAlpnList(kv.alpn) } : {}),
      },
    }
  }

  if (rawName.includes('gost-plugin')) {
    return {
      plugin: 'gost-plugin',
      pluginOpts: {
        mode: kv.mode || 'websocket',
        ...(kv.host ? { host: kv.host } : {}),
        ...(kv.path ? { path: kv.path } : {}),
        ...(flags.has('tls') || parseBoolFlag(kv.tls) ? { tls: true } : {}),
      },
    }
  }

  return {}
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
  let parsedPlugin: { plugin?: string; pluginOpts?: NonNullable<SSProxy['plugin-opts']> } = {}
  let udpOverTcp = false
  let udpOverTcpVersion: number | undefined

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
        parsedPlugin = parseSip002Plugin(plugin)
      }
      if (parseBoolFlag(params.get('uot')) || parseBoolFlag(params.get('udp-over-tcp'))) {
        udpOverTcp = true
      }
      const uotVer = params.get('udp-over-tcp-version')
      if (uotVer && /^\d+$/.test(uotVer)) {
        udpOverTcpVersion = parseInt(uotVer, 10)
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
      // 支持 SS-2022 明文 method:password@host:port 以及标准 SIP002 Base64 userinfo
      const colonPos = userInfo.indexOf(':')
      const possibleCipher = colonPos > 0 ? userInfo.slice(0, colonPos).toLowerCase() : ''
      if (colonPos > 0 && KNOWN_SS_CIPHERS.has(possibleCipher)) {
        decoded = `${userInfo}@${serverPart}`
      } else {
        decoded = `${decodeBase64Utf8(userInfo)}@${serverPart}`
      }
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
    ...(udpOverTcp ? { 'udp-over-tcp': true } : {}),
    ...(udpOverTcpVersion ? { 'udp-over-tcp-version': udpOverTcpVersion } : {}),
  }

  if (parsedPlugin.plugin && parsedPlugin.pluginOpts) {
    proxy.plugin = parsedPlugin.plugin
    proxy['plugin-opts'] = parsedPlugin.pluginOpts
  }

  return proxy
}

export function validateShadowsocksProxy(proxy: Proxy): boolean {
  return proxy.type === 'ss' && Boolean(proxy.cipher && proxy.password)
}

function formatV2rayPluginOpts(opts: NonNullable<SSProxy['plugin-opts']>): string {
  const parts: string[] = []
  if (opts.mode) parts.push(`mode=${opts.mode}`)
  if (opts.tls) parts.push('tls')
  if (opts.host) parts.push(`host=${opts.host}`)
  if (opts.path) parts.push(`path=${opts.path}`)
  if (opts.mux) parts.push('mux=1')
  return parts.join(';')
}

export function shadowsocksToUri(proxy: SSProxy): string {
  const userInfo = `${proxy['encrypt-method'] || proxy.cipher}:${proxy.password}`
  const encodedUserInfo = encodeBase64UrlUtf8(userInfo)
  let uri = `ss://${encodedUserInfo}@${formatHostForUri(proxy.server)}:${proxy.port}`

  const queryParts: string[] = []
  if (proxy.plugin === 'v2ray-plugin' && proxy['plugin-opts']) {
    const optsStr = formatV2rayPluginOpts(proxy['plugin-opts'])
    queryParts.push(`plugin=${encodeURIComponent(`v2ray-plugin${optsStr ? `;${optsStr}` : ''}`)}`)
  } else if (proxy.plugin === 'shadow-tls' && proxy['plugin-opts']) {
    const p = ['shadow-tls']
    if (proxy['plugin-opts'].host) p.push(`host=${proxy['plugin-opts'].host}`)
    if (proxy['plugin-opts'].password) p.push(`password=${proxy['plugin-opts'].password}`)
    if (proxy['plugin-opts'].version) p.push(`version=${proxy['plugin-opts'].version}`)
    queryParts.push(`plugin=${encodeURIComponent(p.join(';'))}`)
  } else {
    const obfsMode = proxy['plugin-opts']?.mode || proxy.obfs
    const obfsHost = proxy['plugin-opts']?.host || proxy['obfs-host']
    if (obfsMode) {
      const pluginParts = ['obfs-local', `obfs=${obfsMode}`]
      if (obfsHost) pluginParts.push(`obfs-host=${obfsHost}`)
      queryParts.push(`plugin=${encodeURIComponent(pluginParts.join(';'))}`)
    }
  }

  if (proxy['udp-over-tcp']) {
    queryParts.push('uot=1')
  }

  if (queryParts.length > 0) {
    uri += `/?${queryParts.join('&')}`
  }

  if (proxy.name && proxy.name !== proxy.server) {
    uri += `#${encodeURIComponent(proxy.name)}`
  }

  return uri
}

export function shadowsocksToClashProxy(proxy: SSProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.cipher && typeof cleaned['encrypt-method'] === 'string') {
    cleaned.cipher = cleaned['encrypt-method']
  }
  delete cleaned['encrypt-method']
  return cleaned
}

export function shadowsocksToSingboxBundle(proxy: SSProxy): SingboxConversionBundle {
  const multiplex = buildSingboxMultiplex(proxy.smux)
  const outbound: SingboxOutbound = {
    type: 'shadowsocks',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    method: proxy['encrypt-method'] || proxy.cipher || 'aes-256-gcm',
    password: proxy.password || '',
    ...(proxy.udp === false ? { network: 'tcp' } : {}),
    ...(proxy.tfo ? { tcp_fast_open: true } : {}),
    ...(proxy['udp-over-tcp']
      ? {
          udp_over_tcp: proxy['udp-over-tcp-version']
            ? { enabled: true, version: proxy['udp-over-tcp-version'] }
            : { enabled: true },
        }
      : {}),
    ...(multiplex ? { multiplex } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }

  if (proxy.plugin === 'shadow-tls' && proxy['plugin-opts']) {
    const stlsTag = `${proxy.name}-shadowtls`
    const stlsOpts: ShadowTlsOptions = {
      host: proxy['plugin-opts'].host,
      password: proxy['plugin-opts'].password,
      version: proxy['plugin-opts'].version || 3,
      fingerprint: proxy['plugin-opts'].fingerprint,
      'skip-cert-verify': proxy['plugin-opts']['skip-cert-verify'],
      alpn: proxy['plugin-opts'].alpn,
    }
    const stlsOutbound = buildShadowTlsSingboxOutbound(proxy, stlsOpts, stlsTag)
    outbound.detour = stlsTag
    delete outbound.server
    delete outbound.server_port
    return { outbound, extraOutbounds: [stlsOutbound] }
  }

  if (proxy.plugin === 'v2ray-plugin' && proxy['plugin-opts']) {
    outbound.plugin = 'v2ray-plugin'
    outbound.plugin_opts = formatV2rayPluginOpts(proxy['plugin-opts'])
  } else if (proxy.plugin === 'obfs' && proxy['plugin-opts']) {
    outbound.plugin = 'obfs-local'
    outbound.plugin_opts = `obfs=${proxy['plugin-opts'].mode || 'http'};obfs-host=${proxy['plugin-opts'].host || 'www.bing.com'}`
  } else if (proxy.obfs) {
    outbound.plugin = 'obfs-local'
    outbound.plugin_opts = `obfs=${proxy.obfs};obfs-host=${proxy['obfs-host'] || 'www.bing.com'}`
  }

  return { outbound }
}

export function shadowsocksToSingboxOutbound(proxy: SSProxy): SingboxOutbound {
  return shadowsocksToSingboxBundle(proxy).outbound!
}

export const shadowsocksCodec: ProtocolCodec<SSProxy> = {
  types: ['ss'],
  prefixes: ['ss://'],
  parse: parseShadowsocksUri,
  validate: validateShadowsocksProxy,
  toUri: shadowsocksToUri,
  toClashProxy: shadowsocksToClashProxy,
  toSingboxOutbound: shadowsocksToSingboxOutbound,
  toSingboxBundle: shadowsocksToSingboxBundle,
}
