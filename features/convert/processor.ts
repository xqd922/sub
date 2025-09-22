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
  }> {
    logger.info('开始处理订阅:', url)
    
    // 重置计数器
    this.resetCounters()

    let proxies: Proxy[]
    let subscription: SubscriptionInfo

    if (this.isGistUrl(url)) {
      logger.info('检测到 Gist 订阅，获取所有节点')
      proxies = await fetchNodesFromRemote(url)
      subscription = this.createDefaultSubscription()
    } else if (this.isSingleNodeUrl(url)) {
      logger.info('检测到节点链接，使用节点解析器')
      proxies = SingleNodeParser.parseMultiple(url)
      if (!proxies.length) {
        throw new Error('无效的节点链接')
      }
      subscription = this.createDefaultSubscription()
    } else {
      // 标准订阅链接处理
      const response = await NetService.fetchWithRetry(url)
      subscription = this.extractSubscriptionInfo(response)
      proxies = await parseSubscription(url, clientUserAgent)
    }

    return { proxies, subscription }
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