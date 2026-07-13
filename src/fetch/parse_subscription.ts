import { Proxy } from '@/node/types'
import { YamlSubscription } from '@/config/types'
import { logger } from '@/lib/logger'
import { fetchSubscription } from '@/network/client'
import { parseMultipleProxies } from '@/node/node'
import { deduplicateProxies } from '@/node/dedup'
import { isProtocolUrl } from '@/lib/protocol'
import yaml from 'js-yaml'

const MAX_SUBSCRIPTION_SIZE = 10 * 1024 * 1024

function parseProxyList(text: string): Proxy[] {
  const proxyText = text.split(/\s+/).filter(isProtocolUrl).join('\n')
  return deduplicateProxies(parseMultipleProxies(proxyText), { keepStrategy: 'shorter' })
}

export function parseSubscriptionText(text: string): Proxy[] {
  if (text.includes('proxies:')) {
    const config = yaml.load(text) as YamlSubscription
    return deduplicateProxies(config.proxies || [], { keepStrategy: 'shorter' })
  }

  const plainTextProxies = parseProxyList(text)
  return plainTextProxies.length > 0
    ? plainTextProxies
    : parseProxyList(Buffer.from(text.trim(), 'base64').toString('utf-8'))
}

export async function parseSubscriptionResponse(response: Response): Promise<Proxy[]> {
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > MAX_SUBSCRIPTION_SIZE) {
    throw new Error(`订阅文件过大 (${(contentLength / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`)
  }

  const text = await response.text()
  if (!text.trim()) {
    throw new Error('订阅内容为空，请检查订阅链接是否正确')
  }

  const actualSize = new TextEncoder().encode(text).byteLength
  if (actualSize > MAX_SUBSCRIPTION_SIZE) {
    throw new Error(`订阅文件过大 (${(actualSize / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`)
  }

  return parseSubscriptionText(text)
}

export async function parseSubscription(url: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    return parseSubscriptionResponse(await fetchSubscription(url))
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('\n=== 订阅解析失败 ===')
    logger.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    logger.error(`处理耗时: ${duration}ms`)
    logger.error('===================\n')
    throw error
  }
}
