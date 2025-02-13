import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Sink 配置
const SINK_URL = process.env.SINK_URL || 'https://link.xqd.us.kg';
const SINK_TOKEN = process.env.SINK_TOKEN || 'x20030922';

// 从原始订阅 URL 中提取名称
function getNameFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    // 获取 name 参数
    const name = urlObj.searchParams.get('name');
    if (name) {
      return decodeURIComponent(name);
    }
    // 获取 remarks 参数
    const remarks = urlObj.searchParams.get('remarks');
    if (remarks) {
      return decodeURIComponent(remarks);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// 生成固定的短链接标识
function generateSlug(url: string): string {
  try {
    // 从原始订阅链接中提取 token
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');
    if (token) {
      // 使用 token 的前6位作为标识
      return token.slice(0, 6);
    }

    // 如果没有 token，使用 URL 的 MD5 前6位
    const hash = createHash('md5').update(url).digest('hex');
    return hash.slice(0, 6);
  } catch {
    return '';
  }
}

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
      // 从转换后的 URL 中提取原始订阅链接
      const convertedUrl = new URL(url);
      const originalUrl = convertedUrl.searchParams.get('url');
      if (!originalUrl) {
        throw new Error('无法获取原始订阅链接');
      }

      // 使用原始订阅链接生成标识
      const slug = generateSlug(originalUrl);
      if (!slug) {
        throw new Error('无法生成短链接标识');
      }
      console.log('生成短链接标识:', slug);

      // 提取订阅名称
      const name = getNameFromUrl(originalUrl);
      console.log('订阅名称:', name || '未找到');

      // 使用 Sink API 创建短链接
      console.log('创建短链接...');
      const sinkResponse = await fetch(`${SINK_URL}/api/link/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SINK_TOKEN}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Host': new URL(SINK_URL).host
        },
        body: JSON.stringify({ 
          url,
          title: name || '订阅链接',
          description: '由订阅转换服务生成',
          slug
        }),
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
      } else if (sinkResponse.status === 409) {
        // 如果链接已存在，直接返回该链接
        console.log('短链接已存在，返回已有链接');
        const shortUrl = `${SINK_URL}/${slug}`;
        console.log('短链接:', shortUrl);
        console.log(`处理耗时: ${Date.now() - startTime}ms`);
        console.log('=== 处理完成 ===\n');
        
        return NextResponse.json({ 
          shortUrl,
          provider: 'sink',
          reused: true
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
