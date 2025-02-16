import { NextResponse } from 'next/server'
import yaml from 'js-yaml'
import { parseSubscription } from '@/lib/parsers'
import { ClashConfig, Proxy, SubscriptionFetchError } from '@/lib/types'
import { defaultConfig, generateProxyGroups } from '@/config/clash'
import { REGION_MAP, RegionCode } from '@/config/regions'

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
  
  const { flag, name } = REGION_MAP[regionMatch as keyof typeof REGION_MAP]
  
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
    
    // 获取原始订阅信息
    console.log('获取订阅信息...')
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClashX/1.95.1'
      }
    })

    // 打印完整的响应头
    console.log('\n===== 响应头信息 =====')
    const headers = Object.fromEntries(response.headers.entries())
    console.log(headers)
    console.log('=====================\n')
    
    // 从 content-disposition 获取订阅名称
    const contentDisposition = response.headers.get('content-disposition') || ''
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
    const subName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : '未知订阅'
    
    // 获取订阅到期时间和流量信息
    const userInfo = response.headers.get('subscription-userinfo') || ''
    const subscription = {
      name: subName,
      upload: userInfo.match(/upload=(\d+)/)?.[1] || 0,
      download: userInfo.match(/download=(\d+)/)?.[1] || 0,
      total: userInfo.match(/total=(\d+)/)?.[1] || 0,
      expire: userInfo.match(/expire=(\d+)/)?.[1] || 
              response.headers.get('profile-expire') || 
              response.headers.get('expires') || 
              response.headers.get('expire') || 
              response.headers.get('Subscription-Userinfo')?.match(/expire=(\d+)/)?.[1] ||
              '',
      homepage: response.headers.get('profile-web-page-url') || 'https://sub.xqd.us.kg'  // 获取原始订阅的首页
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

    // 解析节点
    const proxies = await parseSubscription(url)
    
    // 重置所有计数器
    Object.keys(counters).forEach(key => {
      counters[key] = 0
    })
    
    // 直接格式化所有节点，保持原始顺序
    const formattedProxies = proxies.map(formatProxyName)

    // 生成最终配置
    const clashConfig: ClashConfig = {
      ...defaultConfig,
      proxies: formattedProxies,
      'proxy-groups': generateProxyGroups(formattedProxies)
    }
    
    // 转换为 YAML，使用紧凑格式
    console.log('转换为 YAML 格式...')
    const yamlConfig = yaml.dump(clashConfig, {
      flowLevel: 2,      // 对对象使用流式格式
      lineWidth: 1000,   // 设置较大的行宽，确保在一行内
      indent: 2,         // 设置缩进
      noRefs: true,      // 避免引用标记
      forceQuotes: false,// 不强制使用引号
      styles: {
        '!!null': 'empty',  // null 值显示为空
        '!!map': 'flow',    // 对象使用流式格式
        '!!seq': 'flow'     // 数组使用流式格式
      }
    })
    console.log('转换完成')
    
    const duration = Date.now() - startTime
    console.log('\n=== 订阅处理完成 ===')
    console.log('处理结果:')
    console.log(`  ├─ 节点总数: ${proxies.length}`)
    console.log(`  ├─ 有效节点: ${formattedProxies.length}`)
    console.log(`  ├─ 处理耗时: ${duration}ms`)
    console.log(`  └─ 配置大小: ${formatBytes(yamlConfig.length)}`)
    console.log('结束时间:', new Date().toLocaleString(), '\n')


    return new NextResponse(yamlConfig, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
        'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`,
        'profile-update-interval': '24',
        'profile-title': Buffer.from(subscription.name).toString('base64'),
        'expires': subscription.expire,
        'profile-web-page-url': subscription.homepage,  // 使用原始订阅的首页
        'profile-expire': subscription.expire,
        'profile-status': 'active'
      }
    })
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    
    // 构建错误响应
    const errorResponse = {
      error: true,
      message: error instanceof Error ? error.message : '未知错误',
      userMessage: error instanceof SubscriptionFetchError ? 
        userFriendlyMessage(error.statusCode || 500) : 
        '订阅获取失败，请稍后重试',
      details: error instanceof SubscriptionFetchError ? {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details
      } : undefined,
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
        status: error instanceof SubscriptionFetchError ? error.statusCode || 500 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    )
  }
}