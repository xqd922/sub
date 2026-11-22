import { NextResponse } from 'next/server'
import { resolveShortLink } from '@/modules/short-link/short-link.repository'
import { generateShortLink } from '@/modules/short-link/short-link.service'
import { handleConversionRequest } from '@/modules/subscription/conversion.handler'
import { parseJsonBody } from '@/server/http/route.utils'
import { logger } from '@/server/logger/logger'

export async function handleShortLinkRedirect(
  request: Request,
  id: string,
): Promise<NextResponse> {
  if (!id || id.length < 4) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const targetUrl = await resolveShortLink(id)
    if (!targetUrl) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const conversionUrl = new URL(request.url)
    conversionUrl.pathname = '/sub'
    conversionUrl.searchParams.set('url', targetUrl)

    return handleConversionRequest(new Request(conversionUrl.toString(), request))
  } catch (error) {
    logger.error('[ShortLink] 跳转处理失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export async function handleShortenPost(request: Request): Promise<NextResponse> {
  const startedAt = Date.now()

  try {
    const body = await parseJsonBody<{ url?: string }>(request)
    if (!body?.url) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    const requestOrigin = new URL(request.url).origin
    logger.debug('开始处理短链接请求', { url: body.url })

    const result = await generateShortLink(body.url, requestOrigin)
    logger.debug('短链接生成成功', {
      provider: result.provider,
      shortUrl: result.shortUrl,
      duration: `${Date.now() - startedAt}ms`,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('短链接生成失败', {
      error: error instanceof Error ? error.message : '未知错误',
      duration: `${Date.now() - startedAt}ms`,
    })
    return NextResponse.json({ error: '所有短链接服务都不可用' }, { status: 503 })
  }
}

export async function handleShortenGet(request: Request): Promise<NextResponse> {
  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 })
  }

  return handleShortenPost(
    new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}
