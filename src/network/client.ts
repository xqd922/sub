import { logger } from '@/logger'

export interface NetworkConfig {
  timeout: number
  retries: number
  delay: number
  userAgents: string[]
  defaultHeaders: Record<string, string>
}

const DEFAULT_CONFIG: NetworkConfig = {
  timeout: 30000,
  retries: 3,
  delay: 1000,
  userAgents: [
    'clash.meta/v1.19.13',
    'mihomo/v1.18.5'
  ],
  defaultHeaders: {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  }
}

let config: NetworkConfig = { ...DEFAULT_CONFIG }

let stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  errors: new Map<string, number>()
}

function recordStats(success: boolean, responseTime: number, error?: string): void {
  stats.totalRequests++

  if (success) {
    stats.successRequests++
  } else {
    stats.failedRequests++
    if (error) {
      const count = stats.errors.get(error) || 0
      stats.errors.set(error, count + 1)
    }
  }

  stats.averageResponseTime =
    (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) /
    stats.totalRequests
}

export function configure(newConfig: Partial<NetworkConfig>): void {
  config = { ...config, ...newConfig }
  logger.debug('网络配置已更新:', newConfig)
}

export function getConfig(): NetworkConfig {
  return { ...config }
}

export function resetConfig(): void {
  config = { ...DEFAULT_CONFIG }
  logger.debug('网络配置已重置为默认值')
}

export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number
    timeout?: number
    delay?: number
    headers?: Record<string, string>
    userAgent?: string  
    fallbackRotation?: boolean  
  } = {}
): Promise<Response> {
  const startTime = Date.now()
  const {
    retries = config.retries,
    timeout = config.timeout,
    delay = config.delay,
    headers = {},
    userAgent,
    fallbackRotation = false
  } = options

  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const currentUA = userAgent ||
      (fallbackRotation
        ? config.userAgents[i % config.userAgents.length]
        : config.userAgents[0])

    try {
      logger.debug(`网络请求尝试 (${i + 1}/${retries}) - User-Agent: ${currentUA}`)

      controller = new AbortController()
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort()
        }
      }, timeout)

      const response = await fetch(url, {
        headers: {
          ...config.defaultHeaders,
          ...(currentUA && { 'User-Agent': currentUA }),
          ...headers
        },
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store'
      })

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseTime = Date.now() - startTime
      recordStats(true, responseTime)

      logger.debug(`网络请求成功: ${response.status} (${responseTime}ms)`)
      return response
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message
      const errorName = lastError.name

      logger.warn(`第 ${i + 1} 次尝试失败: [${errorName}] ${errorMessage}`)

      if (i === retries - 1) {

        const responseTime = Date.now() - startTime
        recordStats(false, responseTime, `${errorName}: ${errorMessage}`)

        throw new Error(`网络请求失败: ${errorMessage} (${errorName})`)
      }

      const waitTime = delay * Math.pow(2, i) 
      logger.debug(`等待 ${waitTime}ms 后重试...`)
      await new Promise(r => setTimeout(r, waitTime))
    }
  }

  throw new Error('所有重试都失败了')
}

export async function fetchSubscription(url: string, _clientUserAgent?: string): Promise<Response> {
  const userAgent = 'ClashX/1.95.1'
  logger.info(`订阅请求 User-Agent: ${userAgent}`)

  return fetchWithRetry(url, {
    retries: 3,
    timeout: 30000,
    userAgent,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  })
}

export async function fetchRemoteNodes(url: string): Promise<Response> {
  return fetchWithRetry(url, {
    retries: 2,
    timeout: 15000,
    fallbackRotation: true, 
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
}

export async function fetchShortUrl(url: string): Promise<Response> {
  return fetchWithRetry(url, {
    retries: 2,
    timeout: 5000,
    fallbackRotation: false,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function getStats() {
  const successRate = stats.totalRequests > 0
    ? (stats.successRequests / stats.totalRequests * 100).toFixed(2)
    : '0'

  return {
    ...stats,
    successRate: `${successRate}%`,
    errorTypes: Object.fromEntries(stats.errors)
  }
}

export function resetStats(): void {
  stats = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errors: new Map()
  }
  logger.debug('网络统计已重置')
}