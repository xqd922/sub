import { logger } from '@/lib/logger'

/**
 * 网络请求服务 - 统一管理所有HTTP请求
 */
export class NetService {
  private static readonly USER_AGENTS = [
    'clash.meta/v1.19.13',
    'ClashX/1.95.1', 
    'Clash/1.18.0',
    'clash-verge/v1.3.8',
    'mihomo/v1.18.5'
  ]

  private static readonly DEFAULT_TIMEOUT = 30000
  private static readonly DEFAULT_RETRIES = 3

  /**
   * 带重试的网络请求
   */
  static async fetchWithRetry(
    url: string, 
    options: {
      retries?: number
      timeout?: number
      headers?: Record<string, string>
    } = {}
  ): Promise<Response> {
    const { 
      retries = this.DEFAULT_RETRIES, 
      timeout = this.DEFAULT_TIMEOUT,
      headers = {}
    } = options

    for (let i = 0; i < retries; i++) {
      let controller: AbortController | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      
      const currentUA = this.USER_AGENTS[i % this.USER_AGENTS.length]
      
      try {
        logger.debug(`尝试获取订阅 (${i + 1}/${retries}) - User-Agent: ${currentUA}`)
        
        controller = new AbortController()
        timeoutId = setTimeout(() => {
          if (controller) {
            controller.abort()
          }
        }, timeout)
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': currentUA,
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
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
          if (response.status === 403) {
            throw new Error(`HTTP 403: 访问被拒绝 (使用 User-Agent: ${currentUA})`)
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        
        logger.warn(`第 ${i + 1} 次尝试失败: [${errorName}] ${errorMessage}`)
        
        if (i === retries - 1) {
          throw new Error(`网络请求失败: ${errorMessage} (${errorName})`)
        }
        
        const delay = Math.min(1000 * Math.pow(2, i), 5000)
        logger.debug(`等待 ${delay}ms 后重试...`)
        await new Promise(r => setTimeout(r, delay))
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
}