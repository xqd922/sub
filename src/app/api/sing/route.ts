import { NextResponse } from 'next/server'
import { parseSubscription } from '@/lib/parsers'
import { generateSingboxConfig } from '@/config/singbox'

export const runtime = 'edge'

export async function GET(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理 sing-box 订阅请求 ===')
  
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return new NextResponse('缺少订阅链接', { status: 400 })
    }

    console.log('原始订阅链接:', url)
    
    // 解析订阅内容获取节点列表
    const proxies = await parseSubscription(url)
    
    // 生成 sing-box 配置
    const config = generateSingboxConfig(proxies)
    
    const duration = Date.now() - startTime
    console.log('\n=== 订阅处理完成 ===')
    console.log('处理结果:')
    console.log(`  ├─ 节点总数: ${proxies.length}`)
    console.log(`  ├─ 处理耗时: ${duration}ms`)
    console.log(`  └─ 配置大小: ${JSON.stringify(config).length} bytes`)
    console.log('结束时间:', new Date().toLocaleString(), '\n')

    return new NextResponse(JSON.stringify(config, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Disposition': `attachment; filename="sing-box.json"`,
      }
    })

  } catch (error) {
    console.error('订阅处理错误:', error)
    return NextResponse.json({ error: '订阅处理失败' }, { status: 500 })
  }
} 