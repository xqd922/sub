import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    
    const response = await fetch(
      `https://cutt.ly/api/api.php?key=${process.env.CUTTLY_TOKEN}&short=${encodeURIComponent(url)}`
    )

    const data = await response.json()
    if (data.url.status === 7) {
      return NextResponse.json({ 
        shortUrl: data.url.shortLink,
        provider: 'Cuttly'
      })
    }

    return NextResponse.json({ error: 'Cuttly 服务不可用' }, { status: 503 })
  } catch (error) {
    return NextResponse.json({ error: '短链接生成失败' }, { status: 500 })
  }
} 