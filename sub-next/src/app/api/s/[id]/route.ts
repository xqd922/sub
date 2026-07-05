import { resolveShortLink } from '@/kv'
import { handleRequest } from '@/convert/handler'
import { logger } from '@/logger'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params

  if (!id || id.length < 4) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const targetUrl = await resolveShortLink(id)

    if (!targetUrl) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const url = new URL(request.url)
    url.pathname = '/api/sub'
    url.searchParams.set('url', targetUrl)

    return handleRequest(new Request(url.toString(), request))
  } catch (error) {
    logger.error('[ShortLink] 处理失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
