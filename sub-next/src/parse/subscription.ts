import { Proxy } from '@/types'
import { logger } from '@/logger'
import { fetchSubscription } from '@/network/client'
import { parseSubscriptionText } from '@/convert/subscription'

export async function parseSubscription(url: string, clientUserAgent?: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    const response = await fetchSubscription(url, clientUserAgent)

    const contentLength = response.headers.get('content-length')
    const MAX_SIZE = 10 * 1024 * 1024

    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error(`订阅文件过大 (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`)
    }

    const text = await response.text()
    if (!text || text.length === 0) {
      throw new Error('订阅内容为空，请检查订阅链接是否正确')
    }

    if (text.length > MAX_SIZE) {
      logger.warn(`订阅文件较大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，处理时间可能较长`)
    }

    return parseSubscriptionText(text)

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('\n=== 订阅解析失败 ===')
    logger.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    logger.error(`处理耗时: ${duration}ms`)
    logger.error('===================\n')
    throw error
  }
}
