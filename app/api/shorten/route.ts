import { NextResponse } from 'next/server'
import { ShortService } from '@/features'
import { logger } from '@/lib/core/logger'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    logger.debug('开始处理短链接请求', { url })

    const result = await ShortService.generate(url)
    const duration = Date.now() - startTime
    
    logger.debug('短链接生成成功', { 
      provider: result.provider,
      shortUrl: result.shortUrl,
      duration: `${duration}ms`
    })

    return NextResponse.json(result)

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    logger.error('短链接生成失败', { 
      error: errorMessage,
      duration: `${duration}ms`
    })
    
    return NextResponse.json(
      { error: '所有短链接服务都不可用' }, 
      { status: 503 }
    )
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 })
  }
  
  return POST(new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  }))
}
