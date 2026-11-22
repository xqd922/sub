import type { TargetClientOverride } from '@/shared/admin.types'
import { decodeBase64Utf8 } from '@/shared/base64.utils'

export const PROXY_URI_PREFIXES = [
  'ss://',
  'ssr://',
  'vmess://',
  'trojan://',
  'vless://',
  'hysteria://',
  'hysteria2://',
  'hy2://',
  'hysteria2+realm://',
  'hy2+realm://',
  'tuic://',
  'socks://',
  'socks5://',
  'socks5h://',
  'socks4://',
  'anytls://',
  'snell://',
  'wireguard://',
  'wg://',
  'ssh://',
  'mieru://',
  'mierus://',
  'naive+https://',
  'naive+quic://',
  'shadowtls://',
  'sudoku://',
  'http-proxy://',
  'https-proxy://',
] as const

export function parsePort(value: string | number | undefined | null, defaultPort = 443): number {
  const port = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(port) || port < 1 || port > 65535) return defaultPort
  return port
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSupportedProxyScheme(value: string): boolean {
  const lower = value.trim().toLowerCase()
  return PROXY_URI_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export function splitSubscriptionSources(raw: string): string[] {
  return raw
    .split(/\r?\n|\|/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function isAllowedSubscriptionSource(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return isHttpUrl(trimmed) || isSupportedProxyScheme(trimmed)
}

export function isAllowedSubscriptionInput(raw: string): boolean {
  const sources = splitSubscriptionSources(raw)
  return sources.length > 0 && sources.every(isAllowedSubscriptionSource)
}

const CUSTOM_SLUG_RE = /^[a-zA-Z0-9_-]{2,32}$/

export function isValidCustomSlug(slug: string): boolean {
  return CUSTOM_SLUG_RE.test(slug.trim())
}

export function buildShortLinkPublicUrl(origin: string, id: string, password?: string): string {
  const base = `${origin}/s/${encodeURIComponent(id)}`
  if (password) {
    return `${base}?key=${encodeURIComponent(password)}`
  }
  return base
}

export function buildConversionUrl(
  origin: string,
  rawSubscriptionUrl: string,
  target: TargetClientOverride = 'auto',
): string {
  const base = `${origin}/sub?url=${encodeURIComponent(rawSubscriptionUrl)}`
  if (target && target !== 'auto') {
    return `${base}&target=${encodeURIComponent(target)}`
  }
  return base
}

/**
 * 如果传入的是转换器自身的 `/sub?url=...` 链接（绝对或相对），解包出原始订阅地址与 target 参数，
 * 避免短链解析时再次包装 `/sub?url=/sub?url=...` 导致自请求死循环。
 */
export function unwrapConversionUrl(rawUrl: string): {
  subscriptionUrl: string
  target?: string
} {
  let current = rawUrl.trim()
  let target: string | undefined

  for (let depth = 0; depth < 3; depth++) {
    try {
      const parsed = current.startsWith('/')
        ? new URL(current, 'https://placeholder.local')
        : new URL(current)

      if (parsed.pathname === '/sub' && parsed.searchParams.has('url')) {
        const inner = parsed.searchParams.get('url')?.trim()
        const paramTarget = parsed.searchParams.get('target')?.trim()
        if (paramTarget && !target) {
          target = paramTarget
        }
        if (inner) {
          current = inner
          continue
        }
      }
      break
    } catch {
      break
    }
  }

  return { subscriptionUrl: current, target }
}

const GENERIC_PATH_SEGMENTS = new Set([
  'raw',
  'sub',
  'subscribe',
  'subscription',
  'link',
  'links',
  'api',
  'get',
  'download',
  'fetch',
  'client',
  'clash',
  'v2ray',
  'v2rayng',
  'singbox',
  'sing-box',
  'profile',
  'config',
  'index',
  'default',
  'v1',
  'v2',
  'v3',
])

const STRIP_EXTENSION_RE = /\.(txt|ya?ml|json|conf|sub|list|ini|nodes)$/i
const HEX_HASH_RE = /^[0-9a-f]{16,}$/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 从 URL 路径末段提取语义化文件名（如 Gist / GitHub Raw 链接末尾的 `Mine`、`Work.yaml`），
 * 自动过滤通用接口路径（`sub`、`subscribe`、`raw` 等）和无意义哈希段。
 */
export function extractFileNameFromUrlPath(rawUrl: string): string | null {
  try {
    const { subscriptionUrl } = unwrapConversionUrl(rawUrl)
    const urlObj = new URL(subscriptionUrl)
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null
    }

    const segments = urlObj.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null

    const rawLast = segments[segments.length - 1]
    let decoded = rawLast
    try {
      decoded = decodeURIComponent(rawLast)
    } catch {
      decoded = rawLast
    }

    const cleaned = decoded.replace(STRIP_EXTENSION_RE, '').trim()
    if (!cleaned) return null

    const lower = cleaned.toLowerCase()
    if (
      GENERIC_PATH_SEGMENTS.has(lower) ||
      HEX_HASH_RE.test(cleaned) ||
      UUID_RE.test(cleaned) ||
      /^\d+$/.test(cleaned)
    ) {
      return null
    }

    return cleaned
  } catch {
    return null
  }
}

const FLAG_EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/gu

/**
 * 清理订阅名称中的国旗 Emoji 与多余分隔符（节点列表保留国旗，订阅卡片标题保持清爽）。
 */
export function cleanSubscriptionTitle(name: string): string {
  const cleaned = name
    .replace(FLAG_EMOJI_RE, '')
    .replace(/^[\s\-_|·•]+|[\s\-_|·•]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || name.trim()
}

const GENERIC_SUBSCRIPTION_NAMES = new Set(['Me', 'Sub', 'Merged', 'Gist', 'Node', '未知订阅'])

function extractVmessName(uri: string): string | null {
  const withoutScheme = uri.slice(8).trim()
  if (!withoutScheme) return null

  const hashIdx = withoutScheme.indexOf('#')
  const payload = (hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx)).trim()
  if (!payload) return null

  try {
    const decoded = decodeBase64Utf8(payload)
    if (!decoded.trim().startsWith('{')) return null
    const parsed = JSON.parse(decoded) as { ps?: unknown; add?: unknown }
    if (typeof parsed.ps === 'string' && parsed.ps.trim()) {
      return cleanSubscriptionTitle(parsed.ps)
    }
    if (typeof parsed.add === 'string' && parsed.add.trim()) {
      return parsed.add.trim()
    }
  } catch {
    // 非 Base64 JSON（如 Xray VMessAEAD URI），回退到通用 URL 解析
  }
  return null
}

function extractSsrName(uri: string): string | null {
  const withoutScheme = uri.slice(6).trim()
  if (!withoutScheme) return null

  try {
    const decoded = decodeBase64Utf8(withoutScheme)
    const querySep = decoded.indexOf('/?')
    const mainPart = querySep === -1 ? decoded : decoded.slice(0, querySep)
    const queryPart = querySep === -1 ? '' : decoded.slice(querySep + 2)

    if (queryPart) {
      const rawRemarks = new URLSearchParams(queryPart).get('remarks')
      if (rawRemarks) {
        try {
          const decodedRemarks = decodeBase64Utf8(rawRemarks).trim()
          if (decodedRemarks) return cleanSubscriptionTitle(decodedRemarks)
        } catch {
          const trimmed = rawRemarks.trim()
          if (trimmed) return cleanSubscriptionTitle(trimmed)
        }
      }
    }

    const parts = mainPart.split(':')
    if (parts.length >= 6) {
      const server = parts
        .slice(0, parts.length - 5)
        .join(':')
        .replace(/^\[|\]$/g, '')
        .trim()
      if (server) return server
    }
  } catch {
    // 回退到通用解析
  }
  return null
}

function extractLegacySsHost(uri: string): string | null {
  const withoutScheme = uri.slice(5)
  const hashIdx = withoutScheme.indexOf('#')
  const main = (hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx))
    .split('?')[0]
    .trim()
  if (!main || main.includes('@')) return null

  try {
    const decoded = decodeBase64Utf8(main)
    const atIdx = decoded.lastIndexOf('@')
    if (atIdx === -1) return null
    const hostPort = decoded.slice(atIdx + 1).trim()
    if (!hostPort) return null
    return new URL(`http://${hostPort}`).hostname || null
  } catch {
    return null
  }
}

function getUrlHostLower(raw: string): string | null {
  try {
    const parsed = raw.startsWith('/')
      ? new URL(raw, 'https://placeholder.local')
      : new URL(raw)
    return parsed.hostname ? parsed.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

export function extractNameFromUrl(url: string, fallback = '未知订阅'): string {
  try {
    const { subscriptionUrl } = unwrapConversionUrl(url)
    const primarySource = splitSubscriptionSources(subscriptionUrl)[0] || subscriptionUrl
    const lowerSource = primarySource.toLowerCase()

    if (lowerSource.startsWith('vmess://')) {
      const vmessName = extractVmessName(primarySource)
      if (vmessName) return vmessName
    }

    if (lowerSource.startsWith('ssr://')) {
      const ssrName = extractSsrName(primarySource)
      if (ssrName) return ssrName
    }

    const urlObj = new URL(primarySource)

    const name =
      urlObj.searchParams.get('name') ||
      urlObj.searchParams.get('remarks') ||
      urlObj.searchParams.get('tag')
    if (name) {
      try {
        return cleanSubscriptionTitle(decodeURIComponent(name))
      } catch {
        return cleanSubscriptionTitle(name)
      }
    }

    if (urlObj.hash && urlObj.hash.length > 1) {
      try {
        return cleanSubscriptionTitle(decodeURIComponent(urlObj.hash.slice(1)))
      } catch {
        return cleanSubscriptionTitle(urlObj.hash.slice(1))
      }
    }

    if (lowerSource.startsWith('ss://')) {
      const ssHost = extractLegacySsHost(primarySource)
      if (ssHost) return ssHost
    }

    const pathFileName = extractFileNameFromUrlPath(primarySource)
    if (pathFileName) return cleanSubscriptionTitle(pathFileName)

    return urlObj.hostname || fallback
  } catch {
    return fallback
  }
}

/**
 * 判断名称是否为通用占位名、包装域名（如转换器自身域名）或原始目标主机名/IP/未解码 Base64 载荷。
 */
export function isWeakSubscriptionName(name: string, rawTargetUrl: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || GENERIC_SUBSCRIPTION_NAMES.has(trimmed)) return true

  const lower = trimmed.toLowerCase()
  const rawTrimmed = rawTargetUrl.trim()
  const { subscriptionUrl } = unwrapConversionUrl(rawTrimmed)

  // 命中历史包装转换器域名（如 https://sub.xqd.pp.ua/sub?url=... 曾落库为 sub.xqd.pp.ua）
  if (subscriptionUrl !== rawTrimmed) {
    const wrapperHost = getUrlHostLower(rawTrimmed)
    if (wrapperHost && lower === wrapperHost) return true
  }

  const primarySource = splitSubscriptionSources(subscriptionUrl)[0] || subscriptionUrl
  const targetHost = getUrlHostLower(primarySource)
  if (targetHost && lower === targetHost) return true

  // 兼容历史版本对未解码 Base64 的 vmess:// / ssr:// / ss:// 落库名
  const lowerSource = primarySource.toLowerCase()
  if (
    lowerSource.startsWith('vmess://') ||
    lowerSource.startsWith('ssr://') ||
    lowerSource.startsWith('ss://')
  ) {
    const payload = primarySource.slice(primarySource.indexOf('://') + 3).split(/[?#]/)[0]
    if (payload && !payload.includes('@')) {
      if (payload === trimmed || (trimmed.length >= 16 && payload.startsWith(trimmed))) {
        return true
      }
      if (lowerSource.startsWith('vmess://')) {
        const vmessName = extractVmessName(primarySource)
        if (vmessName && lower === vmessName.toLowerCase()) {
          // 仅当 vmess 无 ps 而回退为服务器地址（add）时视为弱名
          try {
            const parsed = JSON.parse(decodeBase64Utf8(payload)) as { ps?: unknown; add?: unknown }
            if (
              !(typeof parsed.ps === 'string' && parsed.ps.trim()) &&
              typeof parsed.add === 'string' &&
              parsed.add.trim().toLowerCase() === lower
            ) {
              return true
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return false
}

/**
 * 判断短链当前名称是否属于自动托管命名（允许与对应订阅记录的真实/重命名标题保持同步），
 * 而非管理员手工设置的自定义名称。
 */
export function isAutoManagedShortLinkName(link: {
  name: string
  targetUrl: string
  customName?: boolean
}): boolean {
  if (link.customName === true) return false
  if (link.customName === false) return true

  if (isWeakSubscriptionName(link.name, link.targetUrl)) return true
  const extracted = extractNameFromUrl(link.targetUrl)
  return link.name.trim() === extracted
}

/**
 * 解析短链应展示的名称：
 * 1. 管理员手工命名的短链原样保留；
 * 2. 自动命名短链优先对齐对应订阅记录（ConvertRecord）的真实或重命名标题；
 * 3. 否则从解包并解码后的真实订阅/节点链接提取名称。
 */
export function resolveShortLinkName(
  link: { name: string; targetUrl: string; customName?: boolean },
  matchedSubscriptionName?: string | null,
): string {
  if (!isAutoManagedShortLinkName(link)) {
    return link.name
  }

  const extracted = extractNameFromUrl(link.targetUrl)
  const recordName = matchedSubscriptionName?.trim() || ''

  if (recordName && !isWeakSubscriptionName(recordName, link.targetUrl)) {
    return recordName
  }

  if (!isWeakSubscriptionName(extracted, link.targetUrl)) {
    return extracted
  }

  if (recordName) {
    const rawTrimmed = link.targetUrl.trim()
    const { subscriptionUrl } = unwrapConversionUrl(rawTrimmed)
    const wrapperHost = subscriptionUrl !== rawTrimmed ? getUrlHostLower(rawTrimmed) : null
    if (!wrapperHost || recordName.toLowerCase() !== wrapperHost) {
      return recordName
    }
  }

  return extracted
}
