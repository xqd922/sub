import { logger } from '@/lib/core/logger'

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

/**
 * 网络请求服务 - 统一管理所有HTTP请求
 */
export class NetService {
  private static readonly DEFAULT_CONFIG: NetworkConfig = {
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

  private static config: NetworkConfig = { ...this.DEFAULT_CONFIG }

  /**
   * 配置网络参数
   */
  static configure(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('网络配置已更新:', config)
  }

  /**
   * 获取当前配置
   */
  static getConfig(): NetworkConfig {
    return { ...this.config }
  }

  /**
   * 重置配置为默认值
   */
  static resetConfig(): void {
    this.config = { ...this.DEFAULT_CONFIG }
    logger.debug('网络配置已重置为默认值')
  }

  /**
   * 带重试的网络请求 - 增强版
   */
  static async fetchWithRetry(
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
      retries = this.config.retries,
      timeout = this.config.timeout,
      delay = this.config.delay,
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
          ? this.config.userAgents[i % this.config.userAgents.length]
          : this.config.userAgents[0])
      
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
            ...this.config.defaultHeaders,
            ...(currentUA && { 'User-Agent': currentUA }),
            ...headers
          },
          redirect: 'follow',
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
          mode: 'cors',
          referrerPolicy: 'no-referrer'
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
        this.recordStats(true, responseTime)
        
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
          this.recordStats(false, responseTime, `${errorName}: ${errorMessage}`)
          
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
   * 处理订阅URL参数
   */
  static processSubscriptionUrl(url: string): string {
    const urlObj = new URL(url)
    urlObj.searchParams.set('flag', 'meta')
    urlObj.searchParams.set('types', 'all')
    return urlObj.toString()
  }

  /**
   * 订阅专用网络请求 - 根据客户端类型发送请求
   */
  static async fetchSubscription(url: string, clientUserAgent?: string): Promise<Response> {
    // 直接使用与旧代码完全相同的 fetch 逻辑
    logger.info(`订阅请求 User-Agent: ClashX/1.95.1 (原始: ${clientUserAgent || 'undefined'})`)
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ClashX/1.95.1',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        referrerPolicy: 'no-referrer'
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return response
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }
  }

  /**
   * 远程节点专用网络请求
   */
  static async fetchRemoteNodes(url: string): Promise<Response> {
    return this.fetchWithRetry(url, {
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
  static async fetchShortUrl(url: string): Promise<Response> {
    return this.fetchWithRetry(url, {
      retries: 2,
      timeout: 5000,
      fallbackRotation: false,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * 网络统计和监控
   */
  private static stats = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errors: new Map<string, number>()
  }

  /**
   * 获取网络统计信息
   */
  static getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successRequests / this.stats.totalRequests * 100).toFixed(2)
      : '0'

    return {
      ...this.stats,
      successRate: `${successRate}%`,
      errorTypes: Object.fromEntries(this.stats.errors)
    }
  }

  /**
   * 重置统计信息
   */
  static resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errors: new Map()
    }
    logger.debug('网络统计已重置')
  }

  /**
   * 记录请求统计
   */
  private static recordStats(success: boolean, responseTime: number, error?: string): void {
    this.stats.totalRequests++
    
    if (success) {
      this.stats.successRequests++
    } else {
      this.stats.failedRequests++
      if (error) {
        const count = this.stats.errors.get(error) || 0
        this.stats.errors.set(error, count + 1)
      }
    }

    // 更新平均响应时间
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime) / 
      this.stats.totalRequests
  }
}