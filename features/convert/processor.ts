import { Proxy } from '@/lib/core/types'
import { parseSubscription } from '@/lib/parse/subscription'
import { SingleNodeParser } from '@/lib/parse/node'
import { fetchNodesFromRemote } from '@/lib/parse/remote'
import { REGION_MAP, RegionCode } from '@/lib/format/region'
import { NetService } from '../metrics/network'
import { logger } from '@/lib/core/logger'

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
      proxies = await fetchNodesFromRemote(url)
      subscription = this.createDefaultSubscription()
      isAirportSubscription = false  // Gist 节点不生成 HK 组
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
      const { parseSubscription } = await import('@/lib/parse/subscription')
      proxies = await this.parseSubscriptionWithOriginalMethod(url, clientUserAgent)
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
    
    // 提取倍率信息
    const multiplierMatch = proxy.name.match(/(\d+\.?\d*)[xX倍]/)
    const multiplier = multiplierMatch ? ` | ${multiplierMatch[1]}x` : ''
    
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
           url.startsWith('hy2://')
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
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
    const subName = fileNameMatch ? decodeURIComponent(fileNameMatch[1] || '') : '订阅'
    
    // 获取订阅到期时间和流量信息
    const userInfo = response.headers.get('subscription-userinfo') || ''
    
    // 尝试从多个可能的头部获取首页URL
    const homepageUrl = response.headers.get('profile-web-page-url') || 
                       response.headers.get('web-page-url') ||
                       response.headers.get('homepage') || 
                       response.headers.get('website') || ''
    
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
      homepage: homepageUrl ? this.decodeHomepageUrl(homepageUrl) : 'https://love.521pokemon.com'
    }
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
    const yaml = await import('js-yaml')

    if (text.includes('proxies:')) {
      const config = yaml.load(text) as any
      const proxies = config.proxies || []

      // 使用原来的去重逻辑
      return this.removeDuplicateProxies(proxies)
    }

    // Base64 解码处理
    try {
      const decodedText = Buffer.from(text, 'base64').toString()
      const lines = decodedText.split('\n')
      const proxies: Proxy[] = []

      const { SingleNodeParser } = await import('@/lib/parse/node')

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
   * 去除重复节点
   */
  private static removeDuplicateProxies(proxies: Proxy[]): Proxy[] {
    const seen = new Map<string, Proxy>()
    let infoNodesCount = 0
    let duplicateCount = 0

    logger.log('\n节点处理详情:')
    logger.log('1. 开始过滤信息节点...')

    proxies.forEach(proxy => {
      const excludeKeywords = [
        '官网',
        '剩余流量',
        '距离下次重置',
        '套餐到期',
        '订阅'
      ]

      if (excludeKeywords.some(keyword => proxy.name.includes(keyword))) {
        logger.log(`  [信息] 排除节点: ${proxy.name}`)
        infoNodesCount++
        return
      }

      let key = `${proxy.type}:${proxy.server}:${proxy.port}`

      // 根据不同协议添加额外的识别字段
      switch (proxy.type) {
        case 'hysteria2':
          key += `:${proxy.ports || ''}:${proxy.mport || ''}:${proxy.password || ''}:${proxy.sni || ''}`
          break
        case 'vless':
          key += `:${proxy.uuid || ''}:${proxy.flow || ''}`
          if (proxy['reality-opts']) {
            key += `:${proxy['reality-opts']['public-key'] || ''}:${proxy['reality-opts']['short-id'] || ''}`
          }
          break
        case 'vmess':
          key += `:${proxy.uuid || ''}:${proxy.network || ''}:${proxy.wsPath || ''}`
          break
        case 'ss':
          key += `:${proxy.cipher || ''}:${proxy.password || ''}`
          break
        case 'trojan':
          key += `:${proxy.password || ''}:${proxy.sni || ''}`
          break
      }

      if (seen.has(key)) {
        logger.log(`  [重复] 发现重复节点: ${proxy.name}`)
        duplicateCount++
      }
      seen.set(key, proxy)
    })

    logger.log('\n节点统计信息:')
    logger.log(`  ├─ 原始节点总数: ${proxies.length}`)
    logger.log(`  ├─ 信息节点数量: ${infoNodesCount}`)
    logger.log(`  ├─ 重复节点数量: ${duplicateCount}`)
    logger.log(`  └─ 有效节点数量: ${seen.size}`)

    return Array.from(seen.values())
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
   * 格式化字节数
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * 打印订阅统计信息
   */
  static logSubscriptionStats(subscription: SubscriptionInfo, proxies: Proxy[]): void {
    logger.info('\n=== 订阅基本信息 ===')
    logger.info(`名称: ${subscription.name}`)
    logger.info(`首页: ${subscription.homepage}`)
    logger.info(`流量信息:`)
    logger.info(`  ├─ 上传: ${this.formatBytes(Number(subscription.upload))}`)
    logger.info(`  ├─ 下载: ${this.formatBytes(Number(subscription.download))}`)
    logger.info(`  └─ 总量: ${this.formatBytes(Number(subscription.total))}`)
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
}