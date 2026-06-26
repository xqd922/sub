import { Proxy, YamlSubscription } from '@/lib/core/types'
import { parseProxyUri, parseMultipleProxies } from '@/lib/parse/node'
import { fetchNodesFromRemote } from '@/lib/parse/remote'
import { formatProxies as formatProxiesImpl } from '@/lib/format/proxy'
import { isProtocolUrl, isGistUrl, shouldFormatNodeNames } from '@/lib/core/protocols'
import { fetchSubscription } from '../metrics/network'
import { logger } from '@/lib/core/logger'
import { formatBytes } from '@/lib/core/utils'
import { deduplicateProxies } from '@/lib/core/dedup'
import yaml from 'js-yaml'

/**
 * 订阅信息接口
 */
export interface SubscriptionInfo {
  name: string
  upload: string
  download: string
  total: string
  expire: string
  homepage: string
  updateInterval?: number  // 更新间隔（小时）
}

/**
 * 创建默认订阅信息
 */
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

/**
 * 从 Content-Disposition 头提取文件名
 * 支持多种格式：
 * - filename*=UTF-8''xxx (RFC 5987)
 * - filename="xxx"
 * - filename=xxx
 */
function extractFileName(contentDisposition: string): string {
  if (!contentDisposition) return 'Sub'

  // 优先匹配 RFC 5987 格式: filename*=UTF-8''xxx
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  // 匹配带引号格式: filename="xxx"
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  // 匹配不带引号格式: filename=xxx
  const plainMatch = contentDisposition.match(/filename=([^;\s]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  return 'Sub'
}

/**
 * 解码可能包含错误编码的首页 URL
 */
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

/**
 * 从响应头提取订阅信息
 */
function extractSubscriptionInfo(response: Response): SubscriptionInfo {
  // 从 content-disposition 获取订阅名称
  const contentDisposition = response.headers.get('content-disposition') || ''
  const subName = extractFileName(contentDisposition)

  // 获取订阅到期时间和流量信息
  const userInfo = response.headers.get('subscription-userinfo') || ''

  // 尝试从多个可能的头部获取首页URL
  const homepageUrl = response.headers.get('profile-web-page-url') ||
                     response.headers.get('web-page-url') ||
                     response.headers.get('homepage') ||
                     response.headers.get('website') || ''

  // 获取更新间隔
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

/**
 * 解析订阅文本内容为节点
 */
function parseSubscriptionContent(text: string): Proxy[] {
  if (text.includes('proxies:')) {
    const config = yaml.load(text) as YamlSubscription
    const proxies = config.proxies || []

    // 使用统一的去重函数
    return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
  }

  // Base64 解码处理
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
    // Base64 解码失败，记录警告并返回空数组
    logger.warn('订阅内容解码失败，非有效的 Base64 或 YAML 格式:', e)
    return []
  }
}

/**
 * 处理订阅请求的主入口
 */
export async function processSubscription(url: string, clientUserAgent?: string): Promise<{
  proxies: Proxy[]
  subscription: SubscriptionInfo
  isAirportSubscription: boolean  // 新增：标识是否为机场订阅
}> {
  logger.info('开始处理订阅:', url)

  let proxies: Proxy[]
  let subscription: SubscriptionInfo
  let isAirportSubscription = false  // 默认为非机场订阅

  if (isGistUrl(url)) {
    logger.info('检测到 Gist 订阅，获取所有节点')
    const result = await fetchNodesFromRemote(url)
    proxies = result.proxies
    subscription = createDefaultSubscription()
    // 只有当 Gist 中包含订阅链接时才生成 HK 组
    isAirportSubscription = result.hasSubscriptionUrls
    logger.info(`Gist 包含订阅链接: ${result.hasSubscriptionUrls}, 是否生成 HK 组: ${isAirportSubscription}`)
  } else if (isProtocolUrl(url)) {
    logger.info('检测到节点链接，使用节点解析器')
    proxies = parseMultipleProxies(url)
    if (!proxies.length) {
      throw new Error('无效的节点链接')
    }
    subscription = createDefaultSubscription()
    isAirportSubscription = false  // 单节点不生成 HK 组
  } else {
    // 标准订阅链接处理 - 单次请求同时获取响应头和内容
    const response = await fetchSubscription(url, clientUserAgent)
    subscription = extractSubscriptionInfo(response)

    const text = await response.text()
    proxies = text && text.length > 0 ? parseSubscriptionContent(text) : []
    isAirportSubscription = true  // 标准订阅生成 HK 组
  }

  return { proxies, subscription, isAirportSubscription }
}

/**
 * 批量格式化节点名称（每次调用创建新的计数器）
 */
export function formatProxies(proxies: Proxy[], shouldFormat: boolean): Proxy[] {
  if (!shouldFormat) {
    return [...proxies]
  }
  return formatProxiesImpl(proxies)
}

/**
 * 检查是否需要格式化节点名称
 */
export function shouldFormatNames(url: string): boolean {
  return shouldFormatNodeNames(url)
}

/**
 * 打印订阅统计信息
 */
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

  // 统计节点类型分布
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
