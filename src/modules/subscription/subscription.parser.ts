import yaml from 'js-yaml'
import { parseHttpProxyUri } from '@/modules/proxy/codecs/http.codec'
import { isProxyUri, parseProxyUri } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { parseSingboxJsonConfig } from '@/modules/proxy/sing-box.parser'
import type { YamlSubscription } from '@/modules/renderer/renderer.types'
import { deduplicateProxies } from '@/modules/subscription/proxy-dedup'
import { decodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

const MAX_SUBSCRIPTION_BYTES = 10 * 1024 * 1024

const YAML_TYPE_ALIASES: Record<string, string> = {
  shadowsocks: 'ss',
  shadowsocksr: 'ssr',
  hy2: 'hysteria2',
  hysteria1: 'hysteria',
  socks: 'socks5',
  wg: 'wireguard',
  https: 'http',
}

function normalizeYamlProxies(rawProxies: unknown[]): Proxy[] {
  const normalized: Proxy[] = []
  for (const item of rawProxies) {
    if (!item || typeof item !== 'object') continue
    const record = { ...(item as Record<string, unknown>) }
    if (typeof record.type !== 'string') continue

    const canonicalType = YAML_TYPE_ALIASES[record.type.toLowerCase()] || record.type.toLowerCase()
    record.type = canonicalType

    // WireGuard 多 peer 写法允许顶层省略 server/port
    if (canonicalType === 'wireguard' && (!record.server || !record.port) && Array.isArray(record.peers)) {
      const firstPeer = record.peers[0] as Record<string, unknown> | undefined
      if (firstPeer) {
        if (!record.server && typeof firstPeer.server === 'string') record.server = firstPeer.server
        if (!record.port && firstPeer.port !== undefined) record.port = firstPeer.port
      }
    }

    // Mieru 允许仅写 port-range 而省略 port
    if (canonicalType === 'mieru' && !record.port && typeof record['port-range'] === 'string') {
      record.port = record['port-range'].split('-')[0]
    }

    // Snell 兼容 secret -> psk 别名
    if (canonicalType === 'snell' && !record.psk && typeof record.secret === 'string') {
      record.psk = record.secret
      delete record.secret
    }

    if (typeof record.server !== 'string' || !record.server) continue

    normalized.push({
      ...(record as unknown as Proxy),
      name: typeof record.name === 'string' && record.name.trim() ? record.name : record.server,
      port: parsePort(record.port as string | number | undefined),
    })
  }
  return normalized
}

/** 仅在订阅体节点列表内将显式带端口和认证/备注的 http(s):// 行识别为 HTTP 代理节点 */
function isEmbeddedHttpProxyLine(line: string): boolean {
  const lower = line.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false
  try {
    const parsed = new URL(line)
    if (!parsed.port) return false
    const hasAuth = Boolean(parsed.username || parsed.password)
    const hasEmptyPath = !parsed.pathname || parsed.pathname === '/'
    return hasAuth && hasEmptyPath
  } catch {
    return false
  }
}

function parsePlainProxyLines(text: string): Proxy[] {
  // 按行切分而非按空白切分，保留节点名 (#fragment) 中未编码的空格
  const proxies: Proxy[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (isProxyUri(line)) {
      const parsed = parseProxyUri(line)
      if (parsed) proxies.push(parsed)
    } else if (isEmbeddedHttpProxyLine(line)) {
      try {
        proxies.push(parseHttpProxyUri(line))
      } catch {
        // 忽略无效 HTTP 代理行
      }
    }
  }

  return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
}

function tryParseStructuredSubscription(text: string): Proxy[] | null {
  const trimmed = text.trim()

  // 1. sing-box JSON 配置（含 outbounds / endpoints）
  if (trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown
      const singboxProxies = parseSingboxJsonConfig(parsedJson)
      if (singboxProxies.length > 0) {
        return deduplicateProxies(singboxProxies, { keepStrategy: 'shorter' })
      }
    } catch {
      // 非 JSON，继续向下尝试
    }
  }

  // 2. Clash / Mihomo YAML 配置
  if (/^\s*proxies\s*:/m.test(trimmed)) {
    try {
      const config = yaml.load(trimmed) as YamlSubscription | null
      if (config && Array.isArray(config.proxies)) {
        return deduplicateProxies(normalizeYamlProxies(config.proxies), {
          keepStrategy: 'shorter',
        })
      }
    } catch {
      // YAML 语法无效时降级尝试明文 URI 或 Base64 解析
    }
  }

  return null
}

export function parseSubscriptionText(text: string): Proxy[] {
  const structured = tryParseStructuredSubscription(text)
  if (structured !== null) {
    return structured
  }

  const plainProxies = parsePlainProxyLines(text)
  if (plainProxies.length > 0) {
    return plainProxies
  }

  try {
    const decoded = decodeBase64Utf8(text.trim())
    const decodedStructured = tryParseStructuredSubscription(decoded)
    if (decodedStructured !== null) {
      return decodedStructured
    }
    return parsePlainProxyLines(decoded)
  } catch {
    return []
  }
}

export async function parseSubscriptionResponse(response: Response): Promise<Proxy[]> {
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > MAX_SUBSCRIPTION_BYTES) {
    throw new Error(
      `订阅文件过大 (${(contentLength / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`,
    )
  }

  const text = await response.text()
  if (!text.trim()) {
    throw new Error('订阅内容为空，请检查订阅链接是否正确')
  }

  const actualBytes = new TextEncoder().encode(text).byteLength
  if (actualBytes > MAX_SUBSCRIPTION_BYTES) {
    throw new Error(
      `订阅文件过大 (${(actualBytes / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`,
    )
  }

  return parseSubscriptionText(text)
}
