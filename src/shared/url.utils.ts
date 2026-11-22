import type { TargetClientOverride } from '@/shared/admin.types'

export const PROXY_URI_PREFIXES = [
  'ss://',
  'vmess://',
  'trojan://',
  'vless://',
  'hysteria2://',
  'hy2://',
  'socks://',
  'anytls://',
  'snell://',
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

export function extractNameFromUrl(url: string, fallback = '未知订阅'): string {
  try {
    const { subscriptionUrl } = unwrapConversionUrl(url)
    const urlObj = new URL(subscriptionUrl)

    const name =
      urlObj.searchParams.get('name') ||
      urlObj.searchParams.get('remarks') ||
      urlObj.searchParams.get('tag')
    if (name) {
      try {
        return decodeURIComponent(name)
      } catch {
        return name
      }
    }

    if (urlObj.hash && urlObj.hash.length > 1) {
      try {
        return decodeURIComponent(urlObj.hash.slice(1))
      } catch {
        return urlObj.hash.slice(1)
      }
    }

    const pathFileName = extractFileNameFromUrlPath(subscriptionUrl)
    if (pathFileName) return pathFileName

    return urlObj.hostname || fallback
  } catch {
    return fallback
  }
}
