import { Proxy } from '@/lib/core/types'
import { parseYamlSubscription, parseBase64Subscription } from '@/lib/parse/subscription'
import { SingleNodeParser } from '@/lib/parse/node'
import { fetchNodesFromRemote } from '@/lib/parse/remote'
import { REGION_MAP, RegionCode } from '@/lib/format/region'
import { NetService } from '../metrics/network'
import { logger } from '@/lib/core/logger'
import { formatBytes } from '@/lib/core/utils'

/**
 * 订阅处理服务 - 处理各种订阅源
 */
export class SubService {
  // 节点重命名计数器
  private static counters: Record<string, number> = {}

  /**
   * 处理订阅请求的主入口
   */
  static async processSubscription(url: string, clientUserAgent?: string): Promise<{
    proxies: Proxy[]
    subscription: SubscriptionInfo
    isAirportSubscription: boolean  // 新增：标识是否为机场订阅
  }> {
    logger.info('开始处理订阅:', url)

    // 重置计数器
    this.resetCounters()

    let proxies: Proxy[]
    let subscription: SubscriptionInfo
    let isAirportSubscription = false  // 默认为非机场订阅

    if (this.isGistUrl(url)) {
      logger.info('检测到 Gist 订阅，获取所有节点')
      const result = await fetchNodesFromRemote(url)
      proxies = result.proxies
      subscription = this.createDefaultSubscription()
      // 只有当 Gist 中包含订阅链接时才生成 HK 组
      isAirportSubscription = result.hasSubscriptionUrls
      logger.info(`Gist 包含订阅链接: ${result.hasSubscriptionUrls}, 是否生成 HK 组: ${isAirportSubscription}`)
    } else if (this.isSingleNodeUrl(url)) {
      logger.info('检测到节点链接，使用节点解析器')
      proxies = SingleNodeParser.parseMultiple(url)
      if (!proxies.length) {
        throw new Error('无效的节点链接')
      }
      subscription = this.createDefaultSubscription()
      isAirportSubscription = false  // 单节点不生成 HK 组
    } else {
      // 标准订阅链接处理
      // 先用客户端 UA 获取节点（确保节点正确）
      const response = await NetService.fetchSubscription(url, clientUserAgent)
      subscription = this.extractSubscriptionInfo(response)

      const text = await response.text()
      proxies = text?.includes('proxies:')
        ? parseYamlSubscription(text)
        : text ? parseBase64Subscription(text) : []

      // 如果没有获取到首页 URL，用 ClashX UA 再请求一次获取元数据
      if (subscription.homepage === 'https://sub.xqd.pp.ua') {
        try {
          const metaResponse = await NetService.fetchSubscriptionMeta(url)
          const metaInfo = this.extractSubscriptionInfo(metaResponse)
          if (metaInfo.homepage !== 'https://sub.xqd.pp.ua') {
            subscription.homepage = metaInfo.homepage
          }
        } catch {
          // 忽略元数据请求失败
        }
      }

      isAirportSubscription = true  // 标准订阅生成 HK 组
    }

    return { proxies, subscription, isAirportSubscription }
  }

  /**
   * 格式化节点名称（保留原有的地区重命名逻辑）
   */
  static formatProxyName(proxy: Proxy): Proxy {
    const regionMatch = Object.keys(REGION_MAP).find(key => 
      proxy.name.toLowerCase().includes(key.toLowerCase())
    )
    
    if (!regionMatch) {
      return proxy
    }
    
    const { flag, name } = REGION_MAP[regionMatch as RegionCode]
    
    // 提取倍率信息（支持多种格式：x0.01、0.8x、0.8倍、[0.5x]）
    const match1 = proxy.name.match(/[xX×](\d+\.?\d*)/)  // x0.01 格式
    const match2 = proxy.name.match(/(\d+\.?\d*)[xX×倍]/)  // 0.8x 或 0.8倍 格式
    const multiplierValue = match1?.[1] || match2?.[1]
    const multiplier = multiplierValue ? ` [${multiplierValue}x]` : ''
    
    // 初始化计数器
    this.counters[name] = this.counters[name] || 0
    const num = String(++this.counters[name]).padStart(2, '0')
    
    return {
      ...proxy,
      name: `${flag} ${name} ${num}${multiplier}`.trim()
    }
  }

  /**
   * 批量格式化节点名称
   */
  static formatProxies(proxies: Proxy[], shouldFormat: boolean): Proxy[] {
    if (!shouldFormat) {
      return [...proxies]
    }
    return proxies.map(proxy => this.formatProxyName(proxy))
  }

  /**
   * 检查是否需要格式化节点名称
   */
  static shouldFormatNames(url: string): boolean {
    return !(
      url.startsWith('ss://') ||
      url.startsWith('vmess://') ||
      url.startsWith('trojan://') ||
      url.startsWith('vless://') ||
      url.startsWith('hysteria2://') ||
      url.startsWith('hy2://') ||
      url.startsWith('socks://') ||
      url.startsWith('anytls://') ||
      url.includes('gist.githubusercontent.com')
    )
  }

  /**
   * 重置节点名称计数器
   */
  private static resetCounters(): void {
    Object.keys(this.counters).forEach(key => {
      this.counters[key] = 0
    })
  }

  /**
   * 检查是否为 Gist URL
   */
  private static isGistUrl(url: string): boolean {
    return url.includes('gist.githubusercontent.com')
  }

  /**
   * 检查是否为单节点URL
   */
  private static isSingleNodeUrl(url: string): boolean {
    return url.startsWith('ss://') ||
           url.startsWith('vmess://') ||
           url.startsWith('trojan://') ||
           url.startsWith('vless://') ||
           url.startsWith('hysteria2://') ||
           url.startsWith('hy2://') ||
           url.startsWith('socks://') ||
           url.startsWith('anytls://')
  }

  /**
   * 创建默认订阅信息
   */
  private static createDefaultSubscription(): SubscriptionInfo {
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
   * 从响应头提取订阅信息
   */
  private static extractSubscriptionInfo(response: Response): SubscriptionInfo {
    // 从 content-disposition 获取订阅名称
    const contentDisposition = response.headers.get('content-disposition') || ''
    const subName = this.extractFileName(contentDisposition)

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
      homepage: homepageUrl ? this.decodeHomepageUrl(homepageUrl) : 'https://sub.xqd.pp.ua',
      updateInterval: updateInterval ? parseInt(updateInterval) : undefined
    }
  }

  /**
   * 从 Content-Disposition 头提取文件名
   * 支持多种格式：
   * - filename*=UTF-8''xxx (RFC 5987)
   * - filename="xxx"
   * - filename=xxx
   */
  private static extractFileName(contentDisposition: string): string {
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
  private static decodeHomepageUrl(value: string): string {
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
   * 打印订阅统计信息
   */
  static logSubscriptionStats(subscription: SubscriptionInfo, proxies: Proxy[]): void {
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
}

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