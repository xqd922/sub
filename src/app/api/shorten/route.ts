import { NextResponse } from 'next/server';

// Sink 配置
const SINK_URL = process.env.SINK_URL || 'https://link.xqd.us.kg';
const SINK_TOKEN = process.env.SINK_TOKEN || 'x20030922';

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('\n=== 开始处理短链接请求 ===');
  
  try {
    const { url } = await request.json();
    console.log('原始URL:', url);

    // 校验 URL
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      console.warn('无效的URL格式:', url);
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    try {
      // 首先尝试使用 Sink API
      console.log('尝试使用 Sink API...');
      const sinkResponse = await fetch(`${SINK_URL}/api/link/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SINK_TOKEN}`
        },
        body: JSON.stringify({ 
          url,
          // slug 可选，让系统自动生成
        })
      });

      if (sinkResponse.ok) {
        const data = await sinkResponse.json();
        console.log('Sink API 生成成功:', data.shortLink);
        console.log('响应数据:', data);
        console.log(`处理耗时: ${Date.now() - startTime}ms`);
        console.log('=== 处理完成 ===\n');
        
        return NextResponse.json({ 
          shortUrl: data.shortLink,
          provider: 'sink',
          id: data.link.id
        });
      } else {
        const errorText = await sinkResponse.text();
        console.warn('Sink API 响应错误:', {
          status: sinkResponse.status,
          statusText: sinkResponse.statusText,
          body: errorText
        });
      }
    } catch (sinkError) {
      console.error('Sink API 调用失败:', sinkError);
    }

    // 如果 Sink 失败，回退到 TinyURL
    console.log('回退到 TinyURL API...');
    const tinyResponse = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );

    if (!tinyResponse.ok) {
      console.error(`TinyURL API 错误: 状态码 ${tinyResponse.status}`);
      throw new Error('短链接生成失败');
    }

    const shortUrl = await tinyResponse.text();
    if (!shortUrl || !shortUrl.startsWith('http')) {
      console.error('TinyURL 返回无效数据:', shortUrl);
      throw new Error('TinyURL API 返回无效数据');
    }

    console.log('TinyURL 生成成功:', shortUrl);
    console.log(`处理耗时: ${Date.now() - startTime}ms`);
    console.log('=== 处理完成 ===\n');

    return NextResponse.json({ 
      shortUrl,
      provider: 'tinyurl'
    });

  } catch (error) {
    console.error('短链接生成错误:', error);
    console.log(`处理失败，耗时: ${Date.now() - startTime}ms`);
    console.log('=== 处理失败 ===\n');
    return NextResponse.json(
      { error: '短链接生成失败' },
      { status: 500 }
    );
  }
}

// 可选：支持 GET 请求
export async function GET(request: Request) {
  console.log('\n处理 GET 请求...');
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    console.warn('缺少 URL 参数');
    return NextResponse.json({ error: "请提供 URL 参数" }, { status: 400 });
  }

  console.log('转发到 POST 处理...');
  return POST(request);
}
