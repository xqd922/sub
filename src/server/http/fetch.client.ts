import { logger } from '@/server/logger/logger'

const DEFAULT_USER_AGENTS = ['clash.meta/v1.19.13', 'mihomo/v1.18.5'] as const

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache',
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

      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            ...DEFAULT_HEADERS,
            ...(currentUa ? { 'User-Agent': currentUa } : {}),
            ...headers,
          },
          redirect: 'follow',
          cache: 'no-store',
        },
        timeoutMs,
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.debug(`网络请求成功: ${response.status} (${Date.now() - startedAt}ms)`)
      return response
    } catch (error) {
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
