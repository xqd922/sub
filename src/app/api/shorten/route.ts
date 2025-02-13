import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    // 校验 URL
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 调用 TinyURL API 生成短链接
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );

    if (!response.ok) {
      console.error(`TinyURL API 错误: 状态码 ${response.status}`);
      throw new Error('短链接生成失败');
    }

    const shortUrl = await response.text();

    if (!shortUrl || !shortUrl.startsWith('http')) {
      throw new Error('TinyURL API 返回无效数据');
    }

    return NextResponse.json({ shortUrl });
  } catch (error) {
    console.error('短链接生成错误:', error);
    return NextResponse.json(
      { error: '短链接生成失败' },
      { status: 500 }
    );
  }
}

// 可选：支持 GET 请求
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "请提供 URL 参数" }, { status: 400 });
  }

  return POST(request);
}
