import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    
    // 使用 TinyURL API 生成短链接
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        }
      }
    )
    
    if (!response.ok) {
      throw new Error('短链接生成失败')
    }
    
    const shortUrl = await response.text()
    
    if (shortUrl) {
      return NextResponse.json({ shortUrl })
    } else {
      throw new Error('短链接生成失败')
    }
  } catch (error) {
    console.error('短链接生成错误:', error)
    return NextResponse.json(
      { error: '短链接生成失败' },
      { status: 500 }
    )
  }
} 