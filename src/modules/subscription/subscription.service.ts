import { isProxyUri, parseProxyUriList } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { deduplicateProxies } from '@/modules/subscription/proxy-dedup'
import {
  formatProxiesIfNeeded,
  isGistUrl,
  shouldFormatNodeNames,
} from '@/modules/subscription/proxy-namer'
import { detectRegion } from '@/modules/subscription/region.catalog'
import { fetchNodesFromRemote } from '@/modules/subscription/remote-nodes.fetcher'
import { parseSubscriptionResponse } from '@/modules/subscription/subscription.parser'
import type { SubscriptionInfo, SubscriptionResult } from '@/modules/subscription/subscription.types'
import { getSiteUrl } from '@/server/env.config'
import { assertPublicHttpUrl, fetchWithRetry, fetchWithTimeout } from '@/server/fetch.client'
import { logger } from '@/server/logger'
import type { InspectSubscriptionResult } from '@/shared/admin.types'
import { decodeBase64Utf8 } from '@/shared/base64.utils'
import { formatBytes } from '@/shared/format.utils'
import { extractNameFromUrl, splitSubscriptionSources } from '@/shared/url.utils'

function createDefaultSubscription(name = 'Me'): SubscriptionInfo {
  return {
    name,
    upload: '0',
    download: '0',
    total: '0',
    expire: '',
    homepage: '',
  }
}

function decodeMimeWord(value: string): string {
  return value.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_match, b64: string) => {
    try {
      return decodeBase64Utf8(b64)
    } catch {
      return b64
    }
  })
}

function extractFileName(contentDisposition: string, sourceUrl?: string): string {
  const fallback = sourceUrl ? extractNameFromUrl(sourceUrl, 'Sub') : 'Sub'
  if (!contentDisposition) return fallback

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    const decoded = decodeMimeWord(quotedMatch[1])
    try {
      return decodeURIComponent(decoded)
    } catch {
      return decoded
    }
  }

  const plainMatch = contentDisposition.match(/filename=([^;\s]+)/i)
  if (plainMatch?.[1]) {
    const decoded = decodeMimeWord(plainMatch[1])
    try {
      return decodeURIComponent(decoded)
    } catch {
      return decoded
    }
  }

  return fallback
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
  assertPublicHttpUrl(url)

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

export function extractSubscriptionInfo(response: Response, sourceUrl?: string): SubscriptionInfo {
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
    name: extractFileName(contentDisposition, sourceUrl),
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

async function processSingleSource(source: string): Promise<SubscriptionResult> {
  if (isGistUrl(source)) {
    logger.info('检测到 Gist 订阅，获取所有节点')
    const { proxies } = await fetchNodesFromRemote(source, fetchSubscriptionResponse)
    return { proxies, subscription: createDefaultSubscription() }
  }

  if (isProxyUri(source)) {
    logger.info('检测到节点链接，使用节点解析器')
    const proxies = parseProxyUriList(source)
    if (proxies.length === 0) {
      throw new Error('无效的节点链接')
    }
    return { proxies, subscription: createDefaultSubscription() }
  }

  const response = await fetchSubscriptionResponse(source)
  const subscription = extractSubscriptionInfo(response, source)
  const proxies = await parseSubscriptionResponse(response)
  return { proxies, subscription }
}

export async function processSubscription(rawInput: string): Promise<SubscriptionResult> {
  logger.info('开始处理订阅:', rawInput)

  const sources = splitSubscriptionSources(rawInput)
  if (sources.length <= 1) {
    return processSingleSource(sources[0] || rawInput)
  }

  // 支持多行节点 URI 或以 `|` 分隔的多订阅链接合并
  if (sources.every(isProxyUri)) {
    const proxies = deduplicateProxies(parseProxyUriList(sources.join('\n')), {
      keepStrategy: 'first',
      verbose: true,
    })
    return { proxies, subscription: createDefaultSubscription('Merged') }
  }

  const results = await Promise.allSettled(sources.map(processSingleSource))
  const mergedProxies: Proxy[] = []
  let primarySubscription: SubscriptionInfo | null = null

  for (const outcome of results) {
    if (outcome.status === 'fulfilled') {
      mergedProxies.push(...outcome.value.proxies)
      if (!primarySubscription && outcome.value.subscription.name !== 'Me') {
        primarySubscription = outcome.value.subscription
      }
    } else {
      logger.warn('多订阅合并中部分来源失败，已跳过:', outcome.reason)
    }
  }

  const deduplicated = deduplicateProxies(mergedProxies, {
    keepStrategy: 'first',
    verbose: true,
  })

  return {
    proxies: deduplicated,
    subscription: primarySubscription || createDefaultSubscription('Merged'),
  }
}

export async function inspectSubscription(rawInput: string): Promise<InspectSubscriptionResult> {
  const startedAt = Date.now()
  const { proxies, subscription } = await processSubscription(rawInput)
  const formatted = formatProxiesIfNeeded(proxies, shouldFormatNodeNames(rawInput))

  const protocolCounts: Record<string, number> = {}
  const regionMap = new Map<string, { code: string; flag: string; name: string; count: number }>()

  for (const proxy of formatted) {
    const protocol = proxy.type.toLowerCase()
    protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1

    const region = detectRegion(proxy.name)
    const key = region ? region.code : 'OTHER'
    const existing = regionMap.get(key)
    if (existing) {
      existing.count++
    } else {
      regionMap.set(key, {
        code: key,
        flag: region?.flag || '🌐',
        name: region?.name || 'Other',
        count: 1,
      })
    }
  }

  const regionCounts = Array.from(regionMap.values()).sort((a, b) => b.count - a.count)

  return {
    subscription,
    nodeCount: formatted.length,
    protocolCounts,
    regionCounts,
    sampleNodes: formatted.slice(0, 12).map((proxy) => ({
      name: proxy.name,
      type: proxy.type,
      server: proxy.server,
      port: proxy.port,
    })),
    durationMs: Date.now() - startedAt,
  }
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
