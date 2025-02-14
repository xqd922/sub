import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 服务配置
const SERVICE_CONFIG = {
  bitly: {
    path: '/api/shorten/bitly',
    order: 3,
    retries: 2,
    timeout: 5000
  },
  tinyurl: {
    path: '/api/shorten/tinyurl',
    order: 2,
    retries: 1,
    timeout: 3000
  },
  sink: {
    path: '/api/shorten/sink',
    order: 1,
    retries: 1,
    timeout: 3000
  }
} as const

// 获取排序后的服务列表
const SERVICE_ORDER = Object.entries(SERVICE_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key]) => key as keyof typeof SERVICE_CONFIG)

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理短链接请求 ===')
  
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
    
    console.log('目标URL:', targetUrl)

    // 按顺序尝试服务
    for (const service of SERVICE_ORDER) {
      console.log(`尝试使用服务 [${SERVICE_ORDER.indexOf(service) + 1}/${SERVICE_ORDER.length}]: ${service}`)
      try {
        const response = await fetch(new URL(SERVICE_CONFIG[service].path, request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`${service} 服务成功:`, data)
          console.log(`处理耗时: ${Date.now() - startTime}ms`)
          console.log('=== 处理完成 ===\n')
          return NextResponse.json(data);
        }

        console.log(`${service} 服务返回错误:`, response.status)
      } catch (error) {
        console.error(`${service} 服务失败:`, error)
      }
    }

    console.log('所有服务尝试失败')
    return new NextResponse('所有短链接服务都不可用', { status: 503 })

  } catch (error) {
    console.error('请求处理失败:', error)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理失败 ===\n')
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
