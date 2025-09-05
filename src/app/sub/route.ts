import { NextResponse } from 'next/server'
import yaml from 'js-yaml'
import { parseSubscription } from '@/lib/parsers'
import { Proxy, SubscriptionFetchError } from '@/lib/types'
import { defaultConfig, generateProxyGroups } from '@/config/clash'
import { REGION_MAP, RegionCode } from '@/config/regions'
import { generateSingboxConfig } from '@/config/singbox'
import { previewStyles } from '@/styles/preview'
import { SingleNodeParser } from '@/lib/singleNode'
import { fetchNodesFromRemote } from '@/lib/remoteNodes'
import { subscriptionCache, CachedResponse } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { AppError, ErrorCode, ErrorFactory } from '@/lib/errors'
import { handleError, createErrorResponse } from '@/lib/error-reporter'

export const runtime = 'nodejs'

// 在每次请求开始时重置计数器
const counters: Record<string, number> = {}

function formatProxyName(proxy: Proxy): Proxy {
  // 只从原始节点名称中提取地区信息
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
  counters[name] = counters[name] || 0
  const num = String(++counters[name]).padStart(2, '0')
  
  return {
    ...proxy,
    name: `${flag} ${name} ${num}${multiplier}`.trim()
  }
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 解码可能包含错误编码的首页 URL
function decodeHomepageUrl(value: string): string {
  try {
    // 如果包含类似 ä¸å 这样的错误编码字符，尝试修复
    if (value.includes('ä¸å') || /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value)) {
      // 尝试将错误的 Latin-1 编码转换回 UTF-8
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

// 安全编码 HTTP 头部值，确保只包含 ASCII 字符
function encodeHeaderValue(value: string): string {
  try {
    // 检查是否包含非 ASCII 字符
    if (!/^[\x00-\x7F]*$/.test(value)) {
      // 如果是 URL，尝试使用 Punycode 编码域名部分
      if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
          const url = new URL(value)
          // 使用 Punycode 编码域名
          url.hostname = url.hostname
          return url.toString()
        } catch {
          // URL 解析失败，使用 encodeURIComponent
          return encodeURIComponent(value)
        }
      }
      // 对于其他非 ASCII 字符串，使用 URL 编码
      return encodeURIComponent(value)
    }
    return value
  } catch {
    // 如果编码失败，返回安全的默认值
    return 'https://sub.xqd.pp.ua'
  }
}

// 添加用户友好的错误提示
// 添加重试和超时处理的 fetch 函数
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    
    // 尝试不同的 User-Agent，模拟真实的 Clash 客户端
    const userAgents = [
      'clash.meta/v1.19.13',
      'ClashX/1.95.1', 
      'Clash/1.18.0',
      'clash-verge/v1.3.8',
      'mihomo/v1.18.5'
    ]
    
    const currentUA = userAgents[i % userAgents.length]
    
    try {
      logger.debug(`尝试获取订阅 (${i + 1}/${maxRetries}) - User-Agent: ${currentUA}...`)
      
      // 创建超时控制器
      controller = new AbortController()
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort()
        }
      }, 30000)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': currentUA,
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive'
        },
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store'
      })
      
      // 清除超时
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      if (!response.ok) {
        // 如果是403错误，记录详细信息并继续重试
        if (response.status === 403) {
          throw new Error(`HTTP 403: 访问被拒绝 (使用 User-Agent: ${currentUA})`)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      // 清理资源
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available'
      
      logger.warn(`第 ${i + 1} 次尝试失败: [${errorName}] ${errorMessage}`)
      logger.debug(`错误详情: ${errorStack?.split('\n')[0] || 'No details'}`)
      
      if (i === maxRetries - 1) {
        // 包装为更具体的错误，包含原始错误信息
        throw new Error(`订阅获取失败: ${errorMessage} (${errorName})`)
      }
      
      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, i), 5000)
      logger.debug(`等待 ${delay}ms 后重试...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw new Error('所有重试都失败了')
}

export async function GET(request: Request) {
  const startTime = Date.now()
  const userAgent = request.headers.get('user-agent') || ''
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
  
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    // 验证URL参数
    if (!url) {
      throw AppError.validation('缺少订阅链接参数', 'url', undefined)
    }

    // 基本URL格式验证
    try {
      new URL(url)
    } catch {
      throw ErrorFactory.subscription.invalidUrl(url)
    }

    // 检测客户端类型用于缓存key
    const isSingBox = /sing-box/i.test(userAgent) || /mihomo/i.test(userAgent)
    const isBrowser = /mozilla|chrome|safari|firefox|edge/i.test(userAgent) && !/sing-box|clash/i.test(userAgent)
    const clientType = isSingBox ? 'singbox' : isBrowser ? 'browser' : 'clash'
    
    // 创建缓存键 - 包含URL和客户端类型
    const cacheKey = `sub:${clientType}:${Buffer.from(url).toString('base64').slice(0, 32)}`
    
    // 尝试从缓存获取结果
    const cachedResult = subscriptionCache.get<CachedResponse>(cacheKey)
    if (cachedResult) {
      logger.debug('使用缓存结果:', cacheKey)
      return new NextResponse(cachedResult.content, {
        status: 200,
        headers: cachedResult.headers
      })
    }

    logger.info('开始处理订阅:', url)
    
    // 重置所有计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })

    let proxies: Proxy[]
    let subscription: { name: string; upload: string; download: string; total: string; expire: string; homepage: string }

    // 检查是否是远程 Gist 链接
    if (url.includes('gist.githubusercontent.com')) {
      logger.info('检测到 Gist 订阅，获取所有节点')
      
      // 从远程 Gist 获取节点
      proxies = await fetchNodesFromRemote(url)
      
      // 设置基本订阅信息
      subscription = {
        name: 'Me',
        upload: '0',
        download: '0',
        total: '0',
        expire: '',
        homepage: 'https://sub.xqd.pp.ua'
      }
    } else if (url.startsWith('ss://') || url.startsWith('vmess://') || 
               url.startsWith('trojan://') || url.startsWith('vless://') ||
               url.startsWith('hysteria2://') || url.startsWith('hy2://')) {
      console.log('检测到节点链接，使用节点解析器')
      
      // 使用 SingleNodeParser 解析，它不会重命名节点
      proxies = SingleNodeParser.parseMultiple(url)
      if (!proxies.length) {
        throw new Error('无效的节点链接')
      }
      
      // 添加：对节点按地区排序，但不重命名
      proxies = SingleNodeParser.sortProxiesByRegion(proxies)

      subscription = {
        name: 'Me',
        upload: '0',
        download: '0',
        total: '0',
        expire: '',
        homepage: 'https://sub.xqd.pp.ua'
      }
    } else {
      // 使用新的 fetchWithRetry 函数
      const response = await fetchWithRetry(url)

      const headers = Object.fromEntries(response.headers.entries())
      logger.devOnly('\n===== 响应头信息 =====')      
      logger.devOnly(headers)
      logger.devOnly('=====================\n')
      
      // 从 content-disposition 获取订阅名称
      const contentDisposition = response.headers.get('content-disposition') || ''
      const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
      const subName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : '订阅'
      
      // 获取订阅到期时间和流量信息
      const userInfo = response.headers.get('subscription-userinfo') || ''
      subscription = {
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
        homepage: decodeHomepageUrl(response.headers.get('profile-web-page-url') || 'https://sub.xqd.pp.ua')
      }

      // 打印格式化的订阅信息
      logger.devOnly('\n=== 订阅基本信息 ===')
      logger.devOnly(`名称: ${subscription.name}`)
      logger.devOnly(`首页: ${subscription.homepage}`)
      logger.devOnly(`流量信息:`)
      logger.devOnly(`  ├─ 上传: ${formatBytes(Number(subscription.upload))}`)
      logger.devOnly(`  ├─ 下载: ${formatBytes(Number(subscription.download))}`)
      logger.devOnly(`  └─ 总量: ${formatBytes(Number(subscription.total))}`)
      logger.devOnly(`到期时间: ${subscription.expire ? new Date(Number(subscription.expire) * 1000).toLocaleString() : '未知'}`)
      logger.devOnly('===================\n')

      // 解析订阅节点
      proxies = await parseSubscription(url)
    }

    // 重置所有计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })
    // 添加客户端类型日志
    logger.devOnly('\n=== 客户端信息 ===')
    logger.devOnly(`类型: ${isSingBox ? 'sing-box' : isBrowser ? '浏览器' : 'clash'}`)
    logger.devOnly(`User-Agent: ${userAgent}`)
    logger.devOnly('===================\n')

    // 统计节点类型分布
    const nodeTypes = proxies.reduce((acc, proxy) => {
      const type = proxy.type?.toLowerCase() || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // 按数量排序并格式化显示
    const sortedTypes = Object.entries(nodeTypes)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => {
        const percentage = ((count / proxies.length) * 100).toFixed(1)
        return `  ├─ ${type}: ${count} (${percentage}%)`
      })
      .join('\n')

    logger.devOnly('\n节点类型分布:')
    logger.devOnly(sortedTypes)
    logger.devOnly(`  └─ 总计: ${proxies.length}\n`)

    // 检查是否是需要格式化节点名称的来源
    const shouldFormatNames = !(
      url.startsWith('ss://') || 
      url.startsWith('vmess://') || 
      url.startsWith('trojan://') || 
      url.startsWith('vless://') || 
      url.startsWith('hysteria2://') || 
      url.startsWith('hy2://') || 
      url.includes('gist.githubusercontent.com')
    )

    if (isSingBox) {
      // sing-box 配置
      const config = generateSingboxConfig(proxies, shouldFormatNames)
      const data = JSON.stringify(config, null, 2)
      
      return new NextResponse(data, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
          'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`,
          'profile-update-interval': '24',
          'profile-title': Buffer.from(subscription.name).toString('base64'),
          'expires': subscription.expire,
          'profile-web-page-url': encodeHeaderValue(subscription.homepage),
          'profile-expire': subscription.expire,
          'profile-status': 'active'
        }
      })
    }

    // 关键修改：检查是否为节点链接，如果是则不进行重命名
    let formattedProxies: Proxy[]
    if (url.startsWith('ss://') || url.startsWith('vmess://') || 
        url.startsWith('trojan://') || url.startsWith('vless://') ||
        url.startsWith('hysteria2://') || url.startsWith('hy2://') ||
        url.includes('gist.githubusercontent.com')) {
      // 单节点链接或Gist链接，直接使用原始代理列表，不重命名
      formattedProxies = [...proxies]
    } else {
      // 订阅链接，按原有逻辑进行重命名
      formattedProxies = proxies.map(formatProxyName)
    }
    
    const clashConfig = {
      ...defaultConfig,
      proxies: formattedProxies,
      'proxy-groups': generateProxyGroups(formattedProxies)
    }
    
    // 转换为 YAML
    const yamlConfig = yaml.dump(clashConfig, {
      flowLevel: 2,
      lineWidth: 1000,
      indent: 2,
      noRefs: true,
      forceQuotes: false,
      styles: {
        '!!null': 'empty',
        '!!map': 'flow',
        '!!seq': 'flow'
      }
    })
    
    const singboxConfig = generateSingboxConfig(proxies, shouldFormatNames)
    const jsonConfig = JSON.stringify(singboxConfig, null, 2)
    
    const duration = Date.now() - startTime
    logger.devOnly('\n=== 订阅处理完成 ===')
    logger.devOnly('处理结果:')
    logger.devOnly(`  ├─ 客户端类型: ${isSingBox ? 'sing-box' : isBrowser ? '浏览器' : 'clash'}`)
    logger.devOnly(`  ├─ 节点总数: ${proxies.length}`)
    logger.devOnly(`  ├─ 有效节点: ${formattedProxies.length}`)
    logger.devOnly(`  ├─ 处理耗时: ${duration}ms`)
    logger.devOnly(`  └─ 配置大小: ${formatBytes(yamlConfig.length)}`)
    logger.devOnly('结束时间:', new Date().toLocaleString(), '\n')

    // 如果是浏览器访问，显示并排配置
    if (isBrowser) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>配置预览</title>
          <style>${previewStyles}</style>
        </head>
        <body>
          <div class="container">
            <h2>Clash 配置</h2>
            <pre>${yamlConfig}</pre>
          </div>
          <div class="container">
            <h2>sing-box 配置</h2>
            <pre>${jsonConfig}</pre>
          </div>
        </body>
        </html>
      `
      
      const responseHeaders = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
      
      // 缓存浏览器响应结果 (较短缓存时间)
      subscriptionCache.set(cacheKey, {
        content: html,
        headers: responseHeaders
      }, 2 * 60 * 1000) // 2分钟缓存
      
      return new NextResponse(html, { headers: responseHeaders })
    }

    // 准备响应头
    const responseHeaders = {
      'Content-Type': isSingBox ? 'application/json; charset=utf-8' : 'text/yaml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
      ...(Number(subscription.upload) > 0 || Number(subscription.download) > 0 || Number(subscription.total) > 0 ? {
        'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
      } : {}),
      'profile-update-interval': '24',
      'profile-title': Buffer.from(subscription.name).toString('base64'),
      'expires': subscription.expire,
      'profile-web-page-url': encodeHeaderValue(subscription.homepage),
      'profile-expire': subscription.expire,
      'profile-status': 'active'
    }

    const responseContent = isSingBox ? jsonConfig : yamlConfig
    
    // 缓存配置响应结果 (较长缓存时间)
    subscriptionCache.set(cacheKey, {
      content: responseContent,
      headers: responseHeaders
    }, 5 * 60 * 1000) // 5分钟缓存
    
    return new NextResponse(responseContent, { headers: responseHeaders })
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const url = new URL(request.url).searchParams.get('url') || 'unknown'
    
    let appError: AppError

    // 将各种错误转换为AppError
    if (error instanceof AppError) {
      appError = error
    } else if (error instanceof Error) {
      // 根据错误消息和类型创建相应的AppError
      if (error.message.includes('AbortError') || error.message.includes('timeout')) {
        appError = AppError.timeout('请求超时，请稍后重试')
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        appError = AppError.network('网络连接失败，请检查网络状态')
      } else if (error instanceof SubscriptionFetchError) {
        const statusCode = error.statusCode || 500
        if (statusCode === 403 || statusCode === 401) {
          appError = new AppError(
            ErrorCode.SUBSCRIPTION_FETCH_FAILED,
            '订阅链接访问被拒绝，请检查链接权限',
            statusCode,
            undefined,
            { originalStatusCode: statusCode, details: error.details }
          )
        } else if (statusCode >= 400 && statusCode < 500) {
          appError = ErrorFactory.subscription.invalidUrl(url)
        } else if (statusCode >= 500) {
          appError = new AppError(
            ErrorCode.SUBSCRIPTION_FETCH_FAILED,
            '订阅服务器错误，请稍后重试',
            502,
            undefined,
            { originalStatusCode: statusCode }
          )
        } else {
          appError = ErrorFactory.subscription.fetchFailed(url, error)
        }
      } else {
        appError = AppError.fromError(error, ErrorCode.UNKNOWN_ERROR, 500, {
          duration,
          url
        })
      }
    } else {
      appError = new AppError(
        ErrorCode.UNKNOWN_ERROR,
        '发生未知错误',
        500,
        undefined,
        { originalError: String(error), duration }
      )
    }

    // 添加请求上下文信息
    const enhancedError = new AppError(
      appError.code,
      appError.message,
      appError.statusCode,
      appError.severity,
      {
        ...appError.metadata,
        duration,
        url,
        userAgent: userAgent.substring(0, 200), // 限制长度
        processingTime: `${duration}ms`
      },
      appError.cause
    )

    // 报告错误
    await handleError(enhancedError, {
      url,
      userAgent,
      clientIp,
      additionalData: {
        duration,
        processingTime: `${duration}ms`
      }
    })

    // 返回标准化的错误响应
    const { status, body } = createErrorResponse(enhancedError)
    return new NextResponse(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}