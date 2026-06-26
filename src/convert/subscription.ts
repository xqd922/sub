import { Proxy, YamlSubscription } from '@/types'
import { parseProxyUri, parseMultipleProxies } from '@/parse/node'
import { fetchNodesFromRemote } from '@/parse/remote'
import { formatProxies as formatProxiesImpl } from '@/format/proxy'
import { isProtocolUrl, isGistUrl, shouldFormatNodeNames } from '@/protocol'
import { fetchSubscription } from '@/network/client'
import { logger } from '@/logger'
import { formatBytes } from '@/utils'
import { deduplicateProxies } from '@/dedup'
import yaml from 'js-yaml'

export interface SubscriptionInfo {
  name: string
  upload: string
  download: string
  total: string
  expire: string
  homepage: string
  updateInterval?: number  
}

function createDefaultSubscription(): SubscriptionInfo {
  return {
    name: 'Me',
    upload: '0',
    download: '0',
    total: '0',
    expire: '',
    homepage: 'https://sub.xqd.pp.ua'
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
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const plainMatch = contentDisposition.match(/filename=([^;\s]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  return 'Sub'
}

function decodeHomepageUrl(value: string): string {
  try {
    if (value.includes('ä¸å') || /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value)) {
      const bytes = new Uint8Array(value.length)
      for (let i = 0; i < value.length; i++) {
        bytes[i] = value.charCodeAt(i) & 0xFF
      }
      const decoded = new TextDecoder('utf-8').decode(bytes)
      return decoded
    }
    return value
  } catch {
    return 'https://sub.xqd.pp.ua'
  }
}

function extractSubscriptionInfo(response: Response): SubscriptionInfo {

  const contentDisposition = response.headers.get('content-disposition') || ''
  const subName = extractFileName(contentDisposition)

  const userInfo = response.headers.get('subscription-userinfo') || ''

  const homepageUrl = response.headers.get('profile-web-page-url') ||
                     response.headers.get('web-page-url') ||
                     response.headers.get('homepage') ||
                     response.headers.get('website') || ''

  const updateInterval = response.headers.get('profile-update-interval') || ''

  return {
    name: subName,
    upload: String(userInfo.match(/upload=(\d+)/)?.[1] || 0),
    download: String(userInfo.match(/download=(\d+)/)?.[1] || 0),
    total: String(userInfo.match(/total=(\d+)/)?.[1] || 0),
    expire: String(userInfo.match(/expire=(\d+)/)?.[1] ||
            response.headers.get('profile-expire') ||
            response.headers.get('expires') ||
            response.headers.get('expire') ||
            response.headers.get('Subscription-Userinfo')?.match(/expire=(\d+)/)?.[1] ||
            ''),
    homepage: homepageUrl ? decodeHomepageUrl(homepageUrl) : 'https://sub.xqd.pp.ua',
    updateInterval: updateInterval ? parseInt(updateInterval) : undefined
  }
}

function parseSubscriptionContent(text: string): Proxy[] {
  if (text.includes('proxies:')) {
    const config = yaml.load(text) as YamlSubscription
    const proxies = config.proxies || []

    return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
  }

  try {
    const decodedText = Buffer.from(text, 'base64').toString()
    const lines = decodedText.split('\n')
    const proxies: Proxy[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const proxy = parseProxyUri(line)
        if (proxy) {
          proxies.push(proxy)
        }
      } catch (e) {
        logger.warn('节点解析失败:', e)
      }
    }

    return proxies
  } catch (e) {

    logger.warn('订阅内容解码失败，非有效的 Base64 或 YAML 格式:', e)
    return []
  }
}

export async function processSubscription(url: string, clientUserAgent?: string): Promise<{
  proxies: Proxy[]
  subscription: SubscriptionInfo
  isAirportSubscription: boolean  
}> {
  logger.info('开始处理订阅:', url)

  let proxies: Proxy[]
  let subscription: SubscriptionInfo
  let isAirportSubscription = false  

  if (isGistUrl(url)) {
    logger.info('检测到 Gist 订阅，获取所有节点')
    const result = await fetchNodesFromRemote(url)
    proxies = result.proxies
    subscription = createDefaultSubscription()

    isAirportSubscription = result.hasSubscriptionUrls
    logger.info(`Gist 包含订阅链接: ${result.hasSubscriptionUrls}, 是否生成 HK 组: ${isAirportSubscription}`)
  } else if (isProtocolUrl(url)) {
    logger.info('检测到节点链接，使用节点解析器')
    proxies = parseMultipleProxies(url)
    if (!proxies.length) {
      throw new Error('无效的节点链接')
    }
    subscription = createDefaultSubscription()
    isAirportSubscription = false  
  } else {

    const response = await fetchSubscription(url, clientUserAgent)
    subscription = extractSubscriptionInfo(response)

    const text = await response.text()
    proxies = text && text.length > 0 ? parseSubscriptionContent(text) : []
    isAirportSubscription = true  
  }

  return { proxies, subscription, isAirportSubscription }
}

export function formatProxies(proxies: Proxy[], shouldFormat: boolean): Proxy[] {
  if (!shouldFormat) {
    return [...proxies]
  }
  return formatProxiesImpl(proxies)
}

export function shouldFormatNames(url: string): boolean {
  return shouldFormatNodeNames(url)
}

export function logSubscriptionStats(subscription: SubscriptionInfo, proxies: Proxy[]): void {
  logger.info('\n=== 订阅基本信息 ===')
  logger.info(`名称: ${subscription.name}`)
  logger.info(`首页: ${subscription.homepage}`)
  logger.info(`流量信息:`)
  logger.info(`  ├─ 上传: ${formatBytes(Number(subscription.upload))}`)
  logger.info(`  ├─ 下载: ${formatBytes(Number(subscription.download))}`)
  logger.info(`  └─ 总量: ${formatBytes(Number(subscription.total))}`)
  logger.info(`到期时间: ${subscription.expire ? new Date(Number(subscription.expire) * 1000).toLocaleString() : '未知'}`)
  logger.info('===================\n')

  const nodeTypes = proxies.reduce((acc, proxy) => {
    const type = proxy.type?.toLowerCase() || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedTypes = Object.entries(nodeTypes)
    .sort(([,a], [,b]) => b - a)
    .map(([type, count]) => {
      const percentage = ((count / proxies.length) * 100).toFixed(1)
      return `  ├─ ${type}: ${count} (${percentage}%)`
    })
    .join('\n')

  logger.info('\n节点类型分布:')
  logger.info(sortedTypes)
  logger.info(`  └─ 总计: ${proxies.length}\n`)
}