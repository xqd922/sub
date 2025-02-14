import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 短链接服务配置
const SERVICES = {
  tinyurl: '/api/shorten/tinyurl',
  sink: '/api/shorten/sink',
  bitly: '/api/shorten/bitly'
} as const

type ServiceType = keyof typeof SERVICES
const PRIMARY_SERVICE: ServiceType = 'bitly'  // 使用 Bitly 作为主服务

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

    // 使用主服务
    console.log(`尝试使用主服务: ${PRIMARY_SERVICE}`)
    try {
      const primaryResponse = await fetch(new URL(SERVICES[PRIMARY_SERVICE], request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      if (primaryResponse.ok) {
        const data = await primaryResponse.json();
        console.log(`${PRIMARY_SERVICE} 服务成功:`, data)
        console.log(`处理耗时: ${Date.now() - startTime}ms`)
        console.log('=== 处理完成 ===\n')
        return NextResponse.json(data);
      }
      
      console.log(`${PRIMARY_SERVICE} 服务返回错误:`, primaryResponse.status)
    } catch (error) {
      console.error(`${PRIMARY_SERVICE} 服务失败:`, error)
    }

    // 主服务失败，使用备选服务
    const backupService = PRIMARY_SERVICE === 'tinyurl' ? 'sink' : 'tinyurl';
    console.log(`尝试使用备选服务: ${backupService}`);
    
    const backupResponse = await fetch(new URL(SERVICES[backupService], request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl })
    });

    const data = await backupResponse.json();
    console.log(`${backupService} 服务结果:`, data)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理完成 ===\n')
    
    return NextResponse.json(data, { status: backupResponse.status });

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
