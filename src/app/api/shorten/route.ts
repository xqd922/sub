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
      // 使用 Sink API
      console.log('尝试使用 Sink API...');
      const sinkResponse = await fetch(`${SINK_URL}/api/link/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SINK_TOKEN}`,
          'Accept': 'application/json',
          // 使用更简单的 User-Agent
          'User-Agent': 'Mozilla/5.0',
          // 移除可能导致问题的头部
          'Host': new URL(SINK_URL).host
        },
        body: JSON.stringify({ 
          url,
          title: '订阅链接',
          description: '由订阅转换服务生成'
        }),
        // 禁用所有自动行为
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        mode: 'cors',
        referrerPolicy: 'no-referrer'
      });

      if (sinkResponse.ok) {
        const data = await sinkResponse.json();
        const shortUrl = `${SINK_URL}/${data.link.slug}`;
        console.log('Sink API 生成成功:', shortUrl);
        console.log('响应数据:', data);
        console.log(`处理耗时: ${Date.now() - startTime}ms`);
        console.log('=== 处理完成 ===\n');
        
        return NextResponse.json({ 
          shortUrl,
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
        throw new Error('Sink API 响应错误');
      }
    } catch (error) {
      console.error('短链接生成失败:', error);
      throw error;
    }
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
