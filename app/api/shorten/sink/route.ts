import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Sink 配置
const SINK_URL = process.env.SINK_URL || 'https://link.xqd.us.kg'
const SINK_TOKEN = process.env.SINK_TOKEN || 'x20030922'

// 生成固定的短链接标识
async function generateSlug(url: string): Promise<string> {
  try {
    // 从原始订阅链接中提取 token
    const urlObj = new URL(url)
    const token = urlObj.searchParams.get('token')
    if (token) {
      // 使用 token 的前6位作为标识
      return token.slice(0, 6)
    }

    // 如果没有 token，使用 URL 的 SHA-256 前6位
    const msgBuffer = new TextEncoder().encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex.slice(0, 6)
  } catch {
    return ''
  }
}

// 从原始订阅 URL 中提取名称
function getNameFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url)
    // 获取 name 参数
    const name = urlObj.searchParams.get('name')
    if (name) {
      return decodeURIComponent(name)
    }
    // 获取 remarks 参数
    const remarks = urlObj.searchParams.get('remarks')
    if (remarks) {
      return decodeURIComponent(remarks)
    }
    return undefined
  } catch {
    return undefined
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理 Sink 短链接请求 ===')
  
  try {
    const { url } = await request.json()
    console.log('原始URL:', url)

    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      console.warn('无效的URL格式:', url)
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    try {
      const convertedUrl = new URL(url)
      const originalUrl = convertedUrl.searchParams.get('url')
      if (!originalUrl) {
        throw new Error('无法获取原始订阅链接')
      }

      const name = getNameFromUrl(originalUrl)
      // 等待 generateSlug 完成
      const slug = await generateSlug(originalUrl)
      if (!slug) {
        throw new Error('无法生成短链接标识')
      }

      console.log('调用 Sink API...')
      const sinkResponse = await fetch(`${SINK_URL}/api/link/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SINK_TOKEN}`
        },
        body: JSON.stringify({
          url,
          title: name || '订阅链接',
          description: '由订阅转换服务生成',
          slug
        })
      })

      if (sinkResponse.ok) {
        const data = await sinkResponse.json()
        const shortUrl = `${SINK_URL}/${data.link.slug}`
        console.log('短链接生成成功:', shortUrl)
        console.log(`处理耗时: ${Date.now() - startTime}ms`)
        console.log('=== 处理完成 ===\n')
        
        return NextResponse.json({ 
          shortUrl,
          provider: 'Sink',
          id: data.link.id
        })
      } else if (sinkResponse.status === 409) {
        const shortUrl = `${SINK_URL}/${slug}`
        console.log('短链接已存在:', shortUrl)
        console.log(`处理耗时: ${Date.now() - startTime}ms`)
        console.log('=== 处理完成 ===\n')
        
        return NextResponse.json({ 
          shortUrl,
          provider: 'Sink',
          reused: true
        })
      } else {
        const errorText = await sinkResponse.text()
        console.warn('Sink API 响应错误:', {
          status: sinkResponse.status,
          statusText: sinkResponse.statusText,
          body: errorText
        })
        throw new Error('Sink API 响应错误')
      }
    } catch (error) {
      console.error('短链接生成失败:', error)
      throw error
    }
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