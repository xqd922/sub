import { NextResponse } from 'next/server';

export const runtime = 'edge';

// 短链接服务配置
const SERVICES = {
  tinyurl: '/api/shorten/tinyurl',
  sink: '/api/shorten/sink'
} as const

type ServiceType = 'tinyurl' | 'sink'

const PRIMARY_SERVICE: ServiceType = 'tinyurl'

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 使用主服务
    try {
      const primaryResponse = await fetch(new URL(SERVICES[PRIMARY_SERVICE], request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      // 如果主服务成功，直接返回结果
      if (primaryResponse.ok) {
        const data = await primaryResponse.json();
        return NextResponse.json(data);
      }
    } catch {
      console.error(`${PRIMARY_SERVICE} 服务失败`);
    }

    // 主服务失败，使用备选服务
    const backupService = PRIMARY_SERVICE === 'tinyurl' ? 'sink' : 'tinyurl';
    console.log(`尝试使用备选服务: ${backupService}`);
    
    const backupResponse = await fetch(new URL(SERVICES[backupService], request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    // 返回备选服务的结果
    const data = await backupResponse.json();
    return NextResponse.json(data, { status: backupResponse.status });

  } catch {
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
