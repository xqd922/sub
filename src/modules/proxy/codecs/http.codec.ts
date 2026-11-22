import {
  buildSingboxTls,
  cleanStringHeaders,
  extractFragmentName,
  formatHostForUri,
  parseBoolFlag,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  HttpProxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

export function parseHttpProxyUri(uri: string): HttpProxy {
  const lower = uri.toLowerCase()
  const isTls = lower.startsWith('https://') || lower.startsWith('https-proxy://')
  const normalized = lower.startsWith('http-proxy://')
    ? `http://${uri.slice(13)}`
    : lower.startsWith('https-proxy://')
      ? `https://${uri.slice(14)}`
      : uri

  const url = new URL(normalized)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  if (!server) throw new Error('HTTP 代理链接缺少服务器地址')

  let username = safeDecodeUriComponent(url.username)
  let password = safeDecodeUriComponent(url.password)
  if (username && !password) {
    try {
      const decoded = decodeBase64Utf8(username)
      if (decoded.includes(':')) {
        const sep = decoded.indexOf(':')
        username = decoded.slice(0, sep)
        password = decoded.slice(sep + 1)
      }
    } catch {
      // 保留明文用户名
    }
  }

  const tls = isTls || parseBoolFlag(params.get('tls'))
  const skipCertVerify =
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const sni = params.get('sni') || undefined
  const path = url.pathname && url.pathname !== '/' ? url.pathname : undefined

  return {
    type: 'http',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, tls ? 443 : 8080),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(tls ? { tls: true } : {}),
    ...(sni ? { sni } : {}),
    ...(skipCertVerify ? { 'skip-cert-verify': true } : {}),
    ...(path ? { path } : {}),
  }
}

export function validateHttpProxy(proxy: Proxy): boolean {
  return proxy.type === 'http' && Boolean(proxy.server && proxy.port)
}

export function httpProxyToUri(proxy: HttpProxy): string {
  const scheme = proxy.tls ? 'https-proxy' : 'http-proxy'
  const auth =
    proxy.username || proxy.password
      ? `${encodeURIComponent(proxy.username || '')}:${encodeURIComponent(proxy.password || '')}@`
      : ''
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  const path = proxy.path || ''
  const query = params.toString() ? `?${params.toString()}` : ''
  return `${scheme}://${auth}${formatHostForUri(proxy.server)}:${proxy.port}${path}${query}#${encodeURIComponent(proxy.name)}`
}

export function httpProxyToClashProxy(proxy: HttpProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.sni && typeof cleaned.servername === 'string' && cleaned.servername) {
    cleaned.sni = cleaned.servername
  }
  delete cleaned.servername
  delete cleaned.path
  return cleaned
}

export function httpProxyToSingboxOutbound(proxy: HttpProxy): SingboxOutbound {
  const tls = buildSingboxTls(proxy, { forceEnabled: Boolean(proxy.tls) })
  const headers = cleanStringHeaders(proxy.headers)

  return {
    type: 'http',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, proxy.tls ? 443 : 8080),
    ...(proxy.username ? { username: proxy.username } : {}),
    ...(proxy.password ? { password: proxy.password } : {}),
    ...(proxy.path ? { path: proxy.path } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(tls ? { tls } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const httpCodec: ProtocolCodec<HttpProxy> = {
  types: ['http'],
  // 仅将显式 http-proxy:// / https-proxy:// 注册为顶层直连代理前缀，避免劫持普通订阅链接；
  // 解码后的节点列表中的 http://user:pass@host:port 由 subscription.parser 专门识别后调用 parseHttpProxyUri
  prefixes: ['http-proxy://', 'https-proxy://'],
  parse: parseHttpProxyUri,
  validate: validateHttpProxy,
  toUri: httpProxyToUri,
  toClashProxy: httpProxyToClashProxy,
  toSingboxOutbound: httpProxyToSingboxOutbound,
}
