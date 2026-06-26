import { logger } from '@/logger'

/**
 * 网络配置接口
 */
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

/**
 * 网络统计和监控
 */
let stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  errors: new Map<string, number>()
}

/**
 * 记录请求统计
 */
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

  // 更新平均响应时间
  stats.averageResponseTime =
    (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) /
    stats.totalRequests
}

/**
 * 配置网络参数
 */
export function configure(newConfig: Partial<NetworkConfig>): void {
  config = { ...config, ...newConfig }
  logger.debug('网络配置已更新:', newConfig)
}

/**
 * 获取当前配置
 */
export function getConfig(): NetworkConfig {
  return { ...config }
}

/**
 * 重置配置为默认值
 */
export function resetConfig(): void {
  config = { ...DEFAULT_CONFIG }
  logger.debug('网络配置已重置为默认值')
}

/**
 * 带重试的网络请求 - 增强版
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number
    timeout?: number
    delay?: number
    headers?: Record<string, string>
    userAgent?: string  // 指定具体的 User-Agent
    fallbackRotation?: boolean  // 是否启用容灾轮换
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

    // User-Agent 策略：优先使用指定的，否则容灾轮换
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

      // 记录成功统计
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
        // 记录失败统计
        const responseTime = Date.now() - startTime
        recordStats(false, responseTime, `${errorName}: ${errorMessage}`)

        throw new Error(`网络请求失败: ${errorMessage} (${errorName})`)
      }

      const waitTime = delay * Math.pow(2, i) // 指数退避
      logger.debug(`等待 ${waitTime}ms 后重试...`)
      await new Promise(r => setTimeout(r, waitTime))
    }
  }

  throw new Error('所有重试都失败了')
}

/**
 * 订阅专用网络请求 - 使用固定的 ClashX User-Agent 确保订阅获取成功
 */
export async function fetchSubscription(url: string, clientUserAgent?: string): Promise<Response> {
  const userAgent = 'ClashX/1.95.1'
  logger.info(`订阅请求 User-Agent: ${userAgent} (客户端原始: ${clientUserAgent || 'undefined'})`)

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

/**
 * 远程节点专用网络请求
 */
export async function fetchRemoteNodes(url: string): Promise<Response> {
  return fetchWithRetry(url, {
    retries: 2,
    timeout: 15000,
    fallbackRotation: true, // 远程节点使用容灾轮换
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
}

/**
 * 短链接专用网络请求 - 快速响应
 */
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

/**
 * 获取网络统计信息
 */
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

/**
 * 重置统计信息
 */
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
