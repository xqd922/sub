import { NextResponse } from 'next/server';

export const runtime = 'edge';

// 短链接服务配置
const SERVICES = {
  tinyurl: '/api/shorten/tinyurl',
  sink: '/api/shorten/sink'
};

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 优先尝试 TinyURL
    try {
      const tinyResponse = await fetch(new URL(SERVICES.tinyurl, request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (tinyResponse.ok) {
        return tinyResponse;
      }
    } catch (error) {
      console.error('TinyURL 服务失败:', error);
    }

    // 备选使用 Sink
    const sinkResponse = await fetch(new URL(SERVICES.sink, request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (sinkResponse.ok) {
      return sinkResponse;
    }

    return NextResponse.json({ error: '短链接生成失败' }, { status: 500 });
  } catch (error) {
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
