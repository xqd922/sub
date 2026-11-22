import { NextResponse } from 'next/server'
import { resolveShortLink } from '@/modules/short-link/short-link.repository'
import { generateShortLink } from '@/modules/short-link/short-link.service'
import { handleConversionRequest } from '@/modules/subscription/conversion.handler'
import { logger } from '@/server/logger'
import { parseJsonBody } from '@/server/route.utils'
import { isAllowedSubscriptionInput, unwrapConversionUrl } from '@/shared/url.utils'

export async function handleShortLinkRedirect(
  request: Request,
  id: string,
): Promise<NextResponse> {
  if (!id || id.length < 4) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const resolvedTarget = await resolveShortLink(id)
    if (!resolvedTarget) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const incomingUrl = new URL(request.url)
    const incomingTarget = incomingUrl.searchParams.get('target')?.trim()

    // 自动解包历史存储的 `/sub?url=...` 或绝对转换链接，避免二次包装造成自请求死循环
    const unwrapped = unwrapConversionUrl(resolvedTarget)
    const conversionUrl = new URL(incomingUrl.origin)
    conversionUrl.pathname = '/sub'
    conversionUrl.searchParams.set('url', unwrapped.subscriptionUrl)

    const effectiveTarget = incomingTarget || unwrapped.target
    if (effectiveTarget) {
      conversionUrl.searchParams.set('target', effectiveTarget)
    }

    const forwardedRequest = new Request(conversionUrl.toString(), {
      method: 'GET',
      headers: new Headers(request.headers),
    })

    return handleConversionRequest(forwardedRequest)
  } catch (error) {
    logger.error('[ShortLink] 跳转处理失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export async function handleShortenPost(request: Request): Promise<NextResponse> {
  const startedAt = Date.now()

  try {
    const body = await parseJsonBody<{ url?: string }>(request)
    const rawUrl = body?.url?.trim()
    if (!rawUrl) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    const { subscriptionUrl } = unwrapConversionUrl(rawUrl)
    if (!isAllowedSubscriptionInput(subscriptionUrl)) {
      return NextResponse.json({ error: '仅支持有效的 HTTP(S) 订阅链接或代理节点 URI' }, { status: 400 })
    }

    const requestOrigin = new URL(request.url).origin
    logger.debug('开始处理短链接请求', { url: rawUrl })

    const result = await generateShortLink(rawUrl, requestOrigin)
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
