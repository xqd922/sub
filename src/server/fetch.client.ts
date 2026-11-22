import { AppError } from '@/server/app-error'
import { logger } from '@/server/logger'

const DEFAULT_USER_AGENTS = ['clash.meta/v1.19.13', 'mihomo/v1.18.5'] as const

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache',
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  '[::1]',
  '::',
  '[::]',
  'metadata.google.internal',
])

const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^\[?::ffff:/i,
  /^\[?(fc|fd)[0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i,
  /\.local$/i,
  /\.internal$/i,
]

export function isPublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
      return false
    }

    return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}

export function assertPublicHttpUrl(rawUrl: string): void {
  if (!isPublicHttpUrl(rawUrl)) {
    throw AppError.validation('不允许访问内网、回环地址或非 HTTP(S) 协议链接', 'url')
  }
}

export interface FetchRetryOptions {
  retries?: number
  timeoutMs?: number
  baseDelayMs?: number
  headers?: Record<string, string>
  userAgent?: string
  rotateUserAgent?: boolean
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const MAX_REDIRECT_HOPS = 5

async function fetchFollowingSafeRedirects(
  initialUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  let currentUrl = initialUrl

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    assertPublicHttpUrl(currentUrl)

    const response = await fetchWithTimeout(
      currentUrl,
      {
        headers,
        redirect: 'manual',
        cache: 'no-store',
      },
      timeoutMs,
    )

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return response
      if (hop === MAX_REDIRECT_HOPS) {
        throw new Error('重定向次数过多')
      }
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    return response
  }

  throw new Error('重定向次数过多')
}

export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 30_000,
    baseDelayMs = 1000,
    headers = {},
    userAgent,
    rotateUserAgent = false,
  } = options

  assertPublicHttpUrl(url)

  const startedAt = Date.now()
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    const currentUa =
      userAgent ||
      (rotateUserAgent
        ? DEFAULT_USER_AGENTS[attempt % DEFAULT_USER_AGENTS.length]
        : DEFAULT_USER_AGENTS[0])

    try {
      logger.debug(`网络请求尝试 (${attempt + 1}/${retries}) - User-Agent: ${currentUa}`)

      const response = await fetchFollowingSafeRedirects(
        url,
        {
          ...DEFAULT_HEADERS,
          ...(currentUa ? { 'User-Agent': currentUa } : {}),
          ...headers,
        },
        timeoutMs,
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.debug(`网络请求成功: ${response.status} (${Date.now() - startedAt}ms)`)
      return response
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(`第 ${attempt + 1} 次尝试失败: [${lastError.name}] ${lastError.message}`)

      if (attempt === retries - 1) {
        throw new Error(`网络请求失败: ${lastError.message} (${lastError.name})`)
      }

      const waitMs = baseDelayMs * Math.pow(2, attempt)
      logger.debug(`等待 ${waitMs}ms 后重试...`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }

  throw new Error(lastError?.message || '所有重试都失败了')
}
