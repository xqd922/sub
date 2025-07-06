import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const SERVICE_ORDER = [ 'tinyurl','sink', 'bitly'] as const

// 服务配置
const SERVICE_CONFIG = {
  bitly: {
    path: '/api/shorten/bitly',
    retries: 2,
    timeout: 5000
  },
  tinyurl: {
    path: '/api/shorten/tinyurl',
    retries: 1,
    timeout: 3000
  },
  sink: {
    path: '/api/shorten/sink',
    retries: 1,
    timeout: 3000
  }
} as const

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理短链接请求 ===')
  console.log('时间:', new Date().toLocaleString())
  
  try {
    const { url } = await request.json();
    console.log('原始URL:', url)
    
    if (!url) {
      console.log('错误: 无效的 URL')
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 检查是否已经是转换过的链接
    const parsedUrl = new URL(url)
    const originalUrl = parsedUrl.searchParams.get('url')
    
    // 如果不是转换过的链接，需要先转换
    const targetUrl = originalUrl 
      ? url  // 已经是转换过的链接
      : `${request.url.replace('/api/shorten', '/sub')}?url=${encodeURIComponent(url)}`
    
    console.log('\n链接信息:')
    console.log(`  ├─ 原始链接: ${url}`)
    console.log(`  └─ 目标链接: ${targetUrl}`)

    // 显示服务优先级
    console.log('\n服务优先级:')
    SERVICE_ORDER.forEach((service, index) => {
      const config = SERVICE_CONFIG[service]
      console.log(`  ${index + 1}. ${service}`)
      console.log(`     ├─ 超时: ${config.timeout}ms`)
      console.log(`     └─ 重试: ${config.retries}次`)
    })

    // 按顺序尝试服务
    console.log('\n开始尝试服务:')
    for (const service of SERVICE_ORDER) {
      const config = SERVICE_CONFIG[service]
      console.log(`\n[${SERVICE_ORDER.indexOf(service) + 1}/${SERVICE_ORDER.length}] 尝试 ${service} 服务`)
      console.log(`  ├─ 开始时间: ${new Date().toLocaleString()}`)
      
      try {
        const response = await fetch(new URL(config.path, request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });

        if (response.ok) {
          const data = await response.json();
          const duration = Date.now() - startTime
          
          console.log('  ├─ 状态: 成功')
          console.log(`  ├─ 响应时间: ${duration}ms`)
          console.log(`  └─ 短链接: ${data.shortUrl}`)
          
          console.log('\n=== 处理完成 ===')
          console.log(`总耗时: ${duration}ms`)
          console.log('结束时间:', new Date().toLocaleString(), '\n')
          
          return NextResponse.json(data);
        }

        console.log(`  ├─ 状态: 失败 (${response.status})`)
        console.log('  └─ 继续尝试下一个服务')
      } catch (error) {
        console.error(`  ├─ 状态: 错误`)
        console.error(`  └─ 原因: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    const duration = Date.now() - startTime
    console.log('\n=== 处理失败 ===')
    console.log('原因: 所有服务尝试失败')
    console.log(`总耗时: ${duration}ms`)
    console.log('结束时间:', new Date().toLocaleString(), '\n')
    
    return new NextResponse('所有短链接服务都不可用', { status: 503 })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    console.error('\n=== 处理异常 ===')
    console.error('错误信息:', errorMessage)
    console.error(`总耗时: ${duration}ms`)
    console.error('结束时间:', new Date().toLocaleString(), '\n')
    
    return NextResponse.json({ error: '请求处理失败' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 });
  }
  
  return POST(new Request(request.url, {
    method: 'POST',
    body: JSON.stringify({ url })
  }));
}
