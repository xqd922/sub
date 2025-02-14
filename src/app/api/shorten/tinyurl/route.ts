import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理 TinyURL 短链接请求 ===')
  
  try {
    const { url } = await request.json()
    console.log('原始URL:', url)

    if (!url) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    // 使用 TinyURL API 生成短链接
    console.log('调用 TinyURL API...')
    
    // 使用 Promise.race 和超时
    const fetchPromise = fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        }
      }
    )

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), 3000)
    })

    const response = await Promise.race([fetchPromise, timeoutPromise])
      .catch(error => {
        console.error('TinyURL 请求失败:', error)
        return null
      }) as Response | null

    if (!response?.ok) {
      return NextResponse.json({ error: 'TinyURL 服务不可用' }, { status: 503 })
    }

    const shortUrl = await response.text()
    if (!shortUrl) {
      return NextResponse.json({ error: '生成短链接失败' }, { status: 500 })
    }

    console.log('短链接生成成功:', shortUrl)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理完成 ===\n')

    return NextResponse.json({ 
      shortUrl,
      provider: 'TinyURL'
    })

  } catch (error) {
    console.error('短链接生成错误:', error)
    console.log(`处理失败，耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理失败 ===\n')
    return NextResponse.json(
      { error: '短链接生成失败' },
      { status: 500 }
    )
  }
}

// 可选：支持 GET 请求
export async function GET(request: Request) {
  console.log('\n处理 GET 请求...')
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    console.warn('缺少 URL 参数')
    return NextResponse.json({ error: "请提供 URL 参数" }, { status: 400 })
  }

  console.log('转发到 POST 处理...')
  return POST(new Request(request.url, {
    method: 'POST',
    body: JSON.stringify({ url })
  }))
} 