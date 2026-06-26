import { NextResponse } from 'next/server'
import { resolveShortLink } from '@/kv'
import { logger } from '@/logger'

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

    return NextResponse.redirect(targetUrl)
  } catch (error) {
    logger.error('[ShortLink] 重定向失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
