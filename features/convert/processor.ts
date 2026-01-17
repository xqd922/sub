import { Proxy } from '@/lib/core/types'
import { parseSubscription } from '@/lib/parse/subscription'
import { SingleNodeParser } from '@/lib/parse/node'
import { fetchNodesFromRemote } from '@/lib/parse/remote'
import { REGION_MAP, RegionCode, CITY_MAP, MULTI_CITY_COUNTRIES } from '@/lib/format/region'
import { NetService } from '../metrics/network'
import { logger } from '@/lib/core/logger'
import { formatBytes } from '@/lib/core/utils'
import { deduplicateProxies } from '@/lib/core/dedup'
import yaml from 'js-yaml'

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
      // 标准订阅链接处理 - 分别优化两次请求
      // 第一次：使用修复的方法获取响应头信息
      const response = await NetService.fetchSubscription(url, clientUserAgent)
      subscription = this.extractSubscriptionInfo(response)

      // 第二次：使用原来的方法解析节点（确保兼容性）
      proxies = await this.parseSubscriptionWithOriginalMethod(url, clientUserAgent)
      isAirportSubscription = true  // 标准订阅生成 HK 组
    }

    return { proxies, subscription, isAirportSubscription }
  }

  /**
   * 格式化节点名称
   * 格式：
   * - 多城市国家有城市：🇺🇸 USA Seattle 01 [2x]
   * - 多城市国家无城市：🇺🇸 United States 01 [2x]
   * - 单城市国家：🇯🇵 Japan 01 [2x]
   * - 倍率为1时不显示
   */
  static formatProxyName(proxy: Proxy): Proxy {
    // 先检测城市
    const cityMatch = Object.keys(CITY_MAP).find(key =>
      proxy.name.includes(key)
    )

    // 再检测地区
    const regionMatch = Object.keys(REGION_MAP).find(key =>
      proxy.name.toLowerCase().includes(key.toLowerCase())
    )

    if (!regionMatch) {
      return proxy
    }

    const { flag, name: countryCode, en } = REGION_MAP[regionMatch as RegionCode]
    const isMultiCityCountry = countryCode in MULTI_CITY_COUNTRIES

    // 提取倍率
    const multiplier = this.extractMultiplier(proxy.name)

    let displayName: string
    let counterKey: string

    if (cityMatch && isMultiCityCountry) {
      // 多城市国家 + 检测到城市 → 🇺🇸 USA Seattle 01
      const cityInfo = CITY_MAP[cityMatch]
      const countryShort = MULTI_CITY_COUNTRIES[countryCode].short
      displayName = `${flag} ${countryShort} ${cityInfo.city}`
      counterKey = `${countryCode}-${cityInfo.city}`
    } else if (isMultiCityCountry) {
      // 多城市国家 + 未检测到城市 → 🇺🇸 United States 01
      const countryFull = MULTI_CITY_COUNTRIES[countryCode].full
      displayName = `${flag} ${countryFull}`
      counterKey = countryCode
    } else {
      // 单城市国家 → 🇯🇵 Japan 01
      displayName = `${flag} ${en}`
      counterKey = en
    }

    // 初始化计数器
    this.counters[counterKey] = this.counters[counterKey] || 0
    const num = String(++this.counters[counterKey]).padStart(2, '0')

    // 拼接最终名称（倍率非1时显示）
    const multiplierSuffix = multiplier && multiplier !== 1 ? ` [${multiplier}x]` : ''

    return {
      ...proxy,
      name: `${displayName} ${num}${multiplierSuffix}`
    }
  }

  /**
   * 从节点名称中提取倍率
   */
  private static extractMultiplier(name: string): number | undefined {
    // 匹配格式：[2x]、【2x】、(2x)、2x、2×、2倍、x2、*2
    const patterns = [
      /[【\[\(](\d+\.?\d*)[xX×][】\]\)]/,  // [2x]、【2x】、(2x)
      /(\d+\.?\d*)[xX×倍]/,                 // 2x、2×、2倍
      /[xX×*](\d+\.?\d*)/,                  // x2、*2
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        return parseFloat(match[1])
      }
    }

    return undefined
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
   * 使用原来的方法解析订阅节点（确保兼容性）
   */
  private static async parseSubscriptionWithOriginalMethod(url: string, clientUserAgent?: string): Promise<Proxy[]> {
    // 使用原来的网络请求方法
    const response = await NetService.fetchWithRetry(url)
    const text = await response.text()

    if (!text || text.length === 0) {
      return []
    }

    // 直接处理文本内容
    return this.parseSubscriptionContent(text)
  }

  /**
   * 解析订阅文本内容为节点
   */
  private static async parseSubscriptionContent(text: string): Promise<Proxy[]> {
    if (text.includes('proxies:')) {
      const config = yaml.load(text) as any
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
          const proxy = SingleNodeParser.parse(line)
          if (proxy) {
            proxies.push(proxy)
          }
        } catch (e) {
          logger.warn('节点解析失败:', e)
        }
      }

      return proxies
    } catch (e) {
      return []
    }
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