import { isProxyUri, parseProxyUriList } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { isGistUrl } from '@/modules/subscription/proxy-namer'
import { fetchNodesFromRemote } from '@/modules/subscription/remote-nodes.fetcher'
import { parseSubscriptionResponse } from '@/modules/subscription/subscription.parser'
import type { SubscriptionInfo, SubscriptionResult } from '@/modules/subscription/subscription.types'
import { getSiteUrl } from '@/server/env.config'
import { fetchWithRetry, fetchWithTimeout } from '@/server/fetch.client'
import { logger } from '@/server/logger'
import { formatBytes } from '@/shared/format.utils'

function createDefaultSubscription(): SubscriptionInfo {
  return {
    name: 'Me',
    upload: '0',
    download: '0',
    total: '0',
    expire: '',
    homepage: '',
  }
}

function extractFileName(contentDisposition: string): string {
  if (!contentDisposition) return 'Sub'

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]

  const plainMatch = contentDisposition.match(/filename=([^;\s]+)/i)
  if (plainMatch?.[1]) return plainMatch[1]

  return 'Sub'
}

function decodeHomepageUrl(value: string): string {
  try {
    if (value.includes('ä¸å') || /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value)) {
      const bytes = new Uint8Array(value.length)
      for (let i = 0; i < value.length; i++) {
        bytes[i] = value.charCodeAt(i) & 0xff
      }
      return new TextDecoder('utf-8').decode(bytes)
    }
    return value
  } catch {
    return getSiteUrl()
  }
}

export async function fetchSubscriptionResponse(url: string): Promise<Response> {
  const userAgent = 'clash.meta'
  logger.info(`订阅请求 User-Agent: ${userAgent}`)

  const response = await fetchWithRetry(url, {
    retries: 3,
    timeoutMs: 30_000,
    userAgent,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  })

  // 如果 clash.meta 没返回 profile-web-page-url，用 ClashX UA 补一次 HEAD 请求
  if (!response.headers.get('profile-web-page-url')) {
    try {
      const headResponse = await fetchWithTimeout(
        url,
        {
          method: 'HEAD',
          headers: { 'User-Agent': 'ClashX/1.95.1' },
          redirect: 'follow',
        },
        10_000,
      )
      const homepage = headResponse.headers.get('profile-web-page-url')
      if (homepage) {
        const headers = new Headers(response.headers)
        headers.set('profile-web-page-url', homepage)
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      }
    } catch (error) {
      logger.warn('获取 profile-web-page-url 失败:', error)
    }
  }

  return response
}

export function extractSubscriptionInfo(response: Response): SubscriptionInfo {
  const contentDisposition = response.headers.get('content-disposition') || ''
  const userInfo = response.headers.get('subscription-userinfo') || ''

  const homepageUrl =
    response.headers.get('profile-web-page-url') ||
    response.headers.get('web-page-url') ||
    response.headers.get('homepage') ||
    response.headers.get('website') ||
    ''

  const updateInterval = response.headers.get('profile-update-interval') || ''

  return {
    name: extractFileName(contentDisposition),
    upload: String(userInfo.match(/upload=(\d+)/)?.[1] || 0),
    download: String(userInfo.match(/download=(\d+)/)?.[1] || 0),
    total: String(userInfo.match(/total=(\d+)/)?.[1] || 0),
    expire: String(
      userInfo.match(/expire=(\d+)/)?.[1] ||
        response.headers.get('profile-expire') ||
        response.headers.get('expires') ||
        response.headers.get('expire') ||
        response.headers.get('Subscription-Userinfo')?.match(/expire=(\d+)/)?.[1] ||
        '',
    ),
    homepage: homepageUrl ? decodeHomepageUrl(homepageUrl) : getSiteUrl(),
    updateInterval: updateInterval ? parseInt(updateInterval, 10) : undefined,
  }
}

export async function processSubscription(url: string): Promise<SubscriptionResult> {
  logger.info('开始处理订阅:', url)

  if (isGistUrl(url)) {
    logger.info('检测到 Gist 订阅，获取所有节点')
    const { proxies } = await fetchNodesFromRemote(url, fetchSubscriptionResponse)
    return { proxies, subscription: createDefaultSubscription() }
  }

  if (isProxyUri(url)) {
    logger.info('检测到节点链接，使用节点解析器')
    const proxies = parseProxyUriList(url)
    if (proxies.length === 0) {
      throw new Error('无效的节点链接')
    }
    return { proxies, subscription: createDefaultSubscription() }
  }

  const response = await fetchSubscriptionResponse(url)
  const subscription = extractSubscriptionInfo(response)
  const proxies = await parseSubscriptionResponse(response)
  return { proxies, subscription }
}

export function logSubscriptionStats(subscription: SubscriptionInfo, proxies: Proxy[]): void {
  logger.info('\n=== 订阅基本信息 ===')
  logger.info(`名称: ${subscription.name}`)
  logger.info(`首页: ${subscription.homepage}`)
  logger.info('流量信息:')
  logger.info(`  ├─ 上传: ${formatBytes(Number(subscription.upload))}`)
  logger.info(`  ├─ 下载: ${formatBytes(Number(subscription.download))}`)
  logger.info(`  └─ 总量: ${formatBytes(Number(subscription.total))}`)
  logger.info(
    `到期时间: ${subscription.expire ? new Date(Number(subscription.expire) * 1000).toLocaleString() : '未知'}`,
  )
  logger.info('===================\n')

  if (proxies.length === 0) return

  const nodeTypes = proxies.reduce<Record<string, number>>((acc, proxy) => {
    const type = proxy.type?.toLowerCase() || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const sortedTypes = Object.entries(nodeTypes)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => {
      const percentage = ((count / proxies.length) * 100).toFixed(1)
      return `  ├─ ${type}: ${count} (${percentage}%)`
    })
    .join('\n')

  logger.info('\n节点类型分布:')
  logger.info(sortedTypes)
  logger.info(`  └─ 总计: ${proxies.length}\n`)
}
