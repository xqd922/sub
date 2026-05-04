import { NextResponse } from 'next/server'
import { ShortLinkService } from '@/src/infrastructure/storage/kv'
import { requireAuth } from '@/src/infrastructure/auth'
import { logger } from '@/src/infrastructure/logger'


/**
 * GET /api/admin/shortlinks - 获取所有短链接
 */
export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  try {
    const shortLinks = await ShortLinkService.getAll()
    return NextResponse.json({ shortLinks, total: shortLinks.length })
  } catch (error) {
    logger.error('获取短链接失败:', error)
    return NextResponse.json({ error: '获取短链接失败' }, { status: 500 })
  }
}
