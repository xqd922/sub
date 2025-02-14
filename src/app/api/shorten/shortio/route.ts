import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    
    const response = await fetch('https://api.short.io/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SHORTIO_TOKEN
      },
      body: JSON.stringify({
        originalURL: url,
        domain: 'short.io'
      })
    })

    const data = await response.json()
    return NextResponse.json({ 
      shortUrl: data.shortURL,
      provider: 'Short.io'
    })
  } catch (error) {
    return NextResponse.json({ error: '短链接生成失败' }, { status: 500 })
  }
} 