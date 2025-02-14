import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理 Bitly 短链接请求 ===')
  
  try {
    const { url } = await request.json()
    console.log('原始URL:', url)

    // 使用 Bitly v4 API
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BITLY_TOKEN}`
      },
      body: JSON.stringify({
        long_url: url,
        domain: "bit.ly"
      })
    }).catch(error => {
      console.error('Fetch 错误:', error)
      return null
    })

    if (!response?.ok) {
      console.error('API 错误:', await response?.text())
      return NextResponse.json({ error: '服务不可用' }, { status: 503 })
    }

    const data = await response.json()
    const shortUrl = data.link
    console.log('短链接生成成功:', shortUrl)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理完成 ===\n')

    return NextResponse.json({ 
      shortUrl,
      provider: 'Bitly'
    })

  } catch (error) {
    console.error('短链接生成错误:', error)
    console.log(`处理失败，耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理失败 ===\n')
    return NextResponse.json({ error: '短链接生成失败' }, { status: 500 })
  }
} 