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

export function extractNameFromUrl(url: string, fallback = '未知订阅'): string {
  try {
    const { subscriptionUrl } = unwrapConversionUrl(url)
    const urlObj = new URL(subscriptionUrl)

    const name =
      urlObj.searchParams.get('name') ||
      urlObj.searchParams.get('remarks') ||
      urlObj.searchParams.get('tag')
    if (name) return decodeURIComponent(name)

    if (urlObj.hash && urlObj.hash.length > 1) {
      try {
        return decodeURIComponent(urlObj.hash.slice(1))
      } catch {
        return urlObj.hash.slice(1)
      }
    }

    return urlObj.hostname || fallback
  } catch {
    return fallback
  }
}
