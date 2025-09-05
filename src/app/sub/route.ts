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

export const runtime = 'edge'

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
const userFriendlyMessage = (status: number) => {
  switch (status) {
    case 521:
      return '订阅服务器暂时不可用，请稍后再试';
    case 404:
      return '订阅链接无效或已过期';
    case 403:
      return '无权访问此订阅';
    default:
      return '订阅获取失败，请检查链接是否正确';
  }
}

// 添加重试和超时处理的 fetch 函数
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    let controller: AbortController | null = null
    let timeout: NodeJS.Timeout | null = null
    
    try {
      console.log(`尝试获取订阅 (${i + 1}/${maxRetries})...`)
      
      // 创建超时控制器
      controller = new AbortController()
      timeout = setTimeout(() => {
        if (controller) {
          controller.abort()
        }
      }, 30000)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ClashX/1.95.1',
          'Accept': '*/*'
        },
        redirect: 'follow',
        signal: controller.signal,
        next: { revalidate: 0 },
        cache: 'no-store'
      })
      
      // 清除超时
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      // 清理资源
      if (timeout) {
        clearTimeout(timeout)
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`第 ${i + 1} 次尝试失败:`, errorMessage)
      
      if (i === maxRetries - 1) {
        // 包装为更具体的错误
        throw new Error(`订阅获取失败: ${errorMessage}`)
      }
      
      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, i), 5000)
      console.log(`等待 ${delay}ms 后重试...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw new Error('所有重试都失败了')
}

export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return new NextResponse('Missing subscription url', { status: 400 })
    }

    console.log('开始处理订阅:', url)
    
    // 重置所有计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })

    let proxies: Proxy[]
    let subscription: { name: string; upload: string; download: string; total: string; expire: string; homepage: string }

    // 检查是否是远程 Gist 链接
    if (url.includes('gist.githubusercontent.com')) {
      console.log('检测到 Gist 订阅，获取所有节点')
      
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

      // 打印完整的响应头
      console.log('\n===== 响应头信息 =====')
      const headers = Object.fromEntries(response.headers.entries())
      console.log(headers)
      console.log('=====================\n')
      
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
      console.log('\n=== 订阅基本信息 ===')
      console.log(`名称: ${subscription.name}`)
      console.log(`首页: ${subscription.homepage}`)
      console.log(`流量信息:`)
      console.log(`  ├─ 上传: ${formatBytes(Number(subscription.upload))}`)
      console.log(`  ├─ 下载: ${formatBytes(Number(subscription.download))}`)
      console.log(`  └─ 总量: ${formatBytes(Number(subscription.total))}`)
      console.log(`到期时间: ${subscription.expire ? new Date(Number(subscription.expire) * 1000).toLocaleString() : '未知'}`)
      console.log('===================\n')

      // 解析订阅节点
      proxies = await parseSubscription(url)
    }

    // 重置所有计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })
    
    // 获取 User-Agent 并判断客户端类型
    const userAgent = request.headers.get('user-agent') || ''
    const isSingBox = userAgent.toLowerCase().includes('sing-box')
    const isBrowser = userAgent.includes('Mozilla/') || userAgent.includes('Chrome/') || userAgent.includes('Safari/')
    
    // 添加客户端类型日志
    console.log('\n=== 客户端信息 ===')
    console.log(`类型: ${isSingBox ? 'sing-box' : isBrowser ? '浏览器' : 'clash'}`)
    console.log(`User-Agent: ${userAgent}`)
    console.log('===================\n')

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
        return `  ├─ ${type.toUpperCase()}: ${count} (${percentage}%)`
      })
      .join('\n')

    console.log('\n节点类型分布:')
    console.log(sortedTypes)
    console.log(`  └─ 总计: ${proxies.length}\n`)

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
    console.log('\n=== 订阅处理完成 ===')
    console.log('处理结果:')
    console.log(`  ├─ 客户端类型: ${isSingBox ? 'sing-box' : isBrowser ? '浏览器' : 'clash'}`)
    console.log(`  ├─ 节点总数: ${proxies.length}`)
    console.log(`  ├─ 有效节点: ${formattedProxies.length}`)
    console.log(`  ├─ 处理耗时: ${duration}ms`)
    console.log(`  └─ 配置大小: ${formatBytes(yamlConfig.length)}`)
    console.log('结束时间:', new Date().toLocaleString(), '\n')

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
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    return new NextResponse(yamlConfig, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
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
    })
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    
    // 提取更详细的错误信息
    let errorMessage = '未知错误'
    let statusCode = 500
    let errorDetails: { originalError: string; stack?: string } | undefined = undefined
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // 根据错误消息判断错误类型
      if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试'
        statusCode = 408
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络状态'
        statusCode = 502
      } else if (errorMessage.includes('HTTP 4')) {
        statusCode = 400
        errorMessage = '订阅链接无效或已过期'
      } else if (errorMessage.includes('HTTP 5')) {
        statusCode = 502
        errorMessage = '订阅服务器错误，请稍后重试'
      }
      
      // 添加调试信息
      errorDetails = {
        originalError: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      }
    }
    
    // 构建错误响应
    const errorResponse = {
      error: true,
      message: errorMessage,
      userMessage: error instanceof SubscriptionFetchError ? 
        userFriendlyMessage(error.statusCode || 500) : 
        errorMessage,
      details: error instanceof SubscriptionFetchError ? {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details
      } : errorDetails,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    }

    // 记录错误
    console.error('\n=== 处理失败 ===')
    console.error(JSON.stringify(errorResponse, null, 2))
    console.error('================\n')

    return new NextResponse(
      JSON.stringify(errorResponse),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    )
  }
}