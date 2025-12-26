import { NextResponse } from 'next/server'
import { ShortLinkService } from '@/lib/kv'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /s/[id] - 短链接重定向
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params

  if (!id || id.length < 4) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const targetUrl = await ShortLinkService.resolve(id)

    if (!targetUrl) {
      // 短链接不存在，重定向到首页
      return NextResponse.redirect(new URL('/', request.url))
    }

    // 重定向到目标 URL
    return NextResponse.redirect(targetUrl)
  } catch (error) {
    console.error('[ShortLink] 重定向失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
