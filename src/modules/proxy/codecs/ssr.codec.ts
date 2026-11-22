import { sanitizeBaseClashProxy } from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SSRProxy,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8, encodeBase64UrlUtf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

function decodeSsrField(value?: string | null): string {
  if (!value) return ''
  try {
    return decodeBase64Utf8(value)
  } catch {
    return value
  }
}

export function parseSsrUri(uri: string): SSRProxy {
  const raw = uri.slice(6).trim()
  if (!raw) throw new Error('SSR 链接为空')

  const decoded = decodeBase64Utf8(raw)
  const querySep = decoded.indexOf('/?')
  const mainPart = querySep === -1 ? decoded : decoded.slice(0, querySep)
  const queryPart = querySep === -1 ? '' : decoded.slice(querySep + 2)

  // 从末尾向前拆解 5 个冒号，支持 IPv6 地址（如 [::1] 或含冒号的主机段）
  const parts = mainPart.split(':')
  if (parts.length < 6) {
    throw new Error('无效的 SSR 链接格式')
  }
  const passwordB64 = parts.pop()!
  const obfs = parts.pop()!
  const cipher = parts.pop()!
  const protocol = parts.pop()!
  const portStr = parts.pop()!
  const server = parts.join(':').replace(/^\[|\]$/g, '')

  const password = decodeSsrField(passwordB64)
  if (!server || !portStr || !cipher || !password) {
    throw new Error('SSR 链接缺少必要字段')
  }

  const params = new URLSearchParams(queryPart)
  const remarks = decodeSsrField(params.get('remarks'))
  const obfsParam = decodeSsrField(params.get('obfsparam'))
  const protocolParam = decodeSsrField(params.get('protoparam'))

  return {
    type: 'ssr',
    name: remarks || server,
    server,
    port: parsePort(portStr),
    cipher,
    password,
    protocol: protocol || 'origin',
    obfs: obfs || 'plain',
    udp: true,
    ...(obfsParam ? { 'obfs-param': obfsParam } : {}),
    ...(protocolParam ? { 'protocol-param': protocolParam } : {}),
  }
}

export function validateSsrProxy(proxy: Proxy): boolean {
  return proxy.type === 'ssr' && Boolean(proxy.cipher && proxy.password && proxy.protocol && proxy.obfs)
}

export function ssrToUri(proxy: SSRProxy): string {
  const host = proxy.server.includes(':') ? `[${proxy.server}]` : proxy.server
  const main = [
    host,
    String(proxy.port),
    proxy.protocol || 'origin',
    proxy.cipher,
    proxy.obfs || 'plain',
    encodeBase64UrlUtf8(proxy.password),
  ].join(':')

  const queryParts: string[] = []
  if (proxy['obfs-param']) queryParts.push(`obfsparam=${encodeBase64UrlUtf8(proxy['obfs-param'])}`)
  if (proxy['protocol-param']) {
    queryParts.push(`protoparam=${encodeBase64UrlUtf8(proxy['protocol-param'])}`)
  }
  if (proxy.name) queryParts.push(`remarks=${encodeBase64UrlUtf8(proxy.name)}`)

  const payload = queryParts.length > 0 ? `${main}/?${queryParts.join('&')}` : main
  return `ssr://${encodeBase64UrlUtf8(payload)}`
}

export function ssrToClashProxy(proxy: SSRProxy): Record<string, unknown> {
  return sanitizeBaseClashProxy(proxy)
}

export const ssrCodec: ProtocolCodec<SSRProxy> = {
  types: ['ssr'],
  prefixes: ['ssr://'],
  parse: parseSsrUri,
  validate: validateSsrProxy,
  toUri: ssrToUri,
  toClashProxy: ssrToClashProxy,
  // sing-box 1.6+ 已弃用并移除 ShadowsocksR 出站
  toSingboxOutbound: () => null,
}
