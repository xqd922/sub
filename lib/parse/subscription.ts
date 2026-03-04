/**
 * 订阅解析模块
 * 支持 YAML 和 Base64 格式的订阅解析
 */

import { Proxy, ProxyConfig } from '../core/types'
import yaml from 'js-yaml'
import { logger } from '../core/logger'
import { NetService } from '@/features'
import { SingleNodeParser } from './node'
import { deduplicateProxies } from '../core/dedup'

/**
 * 解析订阅链接
 * @param url 订阅链接
 * @param clientUserAgent 客户端 User-Agent
 * @returns 解析后的节点列表
 */
export async function parseSubscription(url: string, clientUserAgent?: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    const response = await NetService.fetchSubscription(url, clientUserAgent)

    // 检查响应大小
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

    // 根据格式选择解析方法
    if (text.includes('proxies:')) {
      return parseYamlSubscription(text)
    }
    return parseBase64Subscription(text)

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('\n=== 订阅解析失败 ===')
    logger.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    logger.error(`处理耗时: ${duration}ms`)
    logger.error('===================\n')
    throw error
  }
}

/** 解析 YAML 格式订阅 */
function parseYamlSubscription(text: string): Proxy[] {
  try {
    const config = yaml.load(text) as ProxyConfig
    const proxies = config.proxies || []
    return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
  } catch (e) {
    logger.warn('YAML 解析失败:', e instanceof Error ? e.message : String(e))
    return []
  }
}

/** 解析 Base64 格式订阅 */
function parseBase64Subscription(text: string): Proxy[] {
  const decodedText = Buffer.from(text, 'base64').toString()
  const lines = decodedText.split('\n')
  const proxies: Proxy[] = []
  let failedCount = 0
  const failedTypes = new Set<string>()

  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed) continue

    try {
      const proxy = SingleNodeParser.parse(trimmed)
      if (proxy) proxies.push(proxy)
    } catch (e) {
      failedCount++
      const protocol = trimmed.split('://')[0] || 'unknown'
      failedTypes.add(protocol)

      if (process.env.NODE_ENV === 'development') {
        logger.debug(`节点解析失败 [${protocol}]: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  if (failedCount > 0) {
    logger.warn(`节点解析完成: 成功 ${proxies.length} 个, 失败 ${failedCount} 个 (协议: ${Array.from(failedTypes).join(', ')})`)
  }

  return proxies
}
