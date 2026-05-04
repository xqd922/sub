import { NextResponse } from 'next/server'
import { ShortLinkService } from '@/src/infrastructure/storage/kv'
import { requireAuth } from '@/src/infrastructure/auth'
import { logger } from '@/src/infrastructure/logger'


interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/admin/shortlinks/[id] - 更新短链接
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const { id } = await params

  try {
    const body = await request.json() as { name?: string }
    const { name } = body

    const updates: Partial<{ name: string }> = {}
    if (typeof name === 'string') updates.name = name

    const shortLink = await ShortLinkService.update(id, updates)
    if (!shortLink) {
      return NextResponse.json({ error: '短链接不存在' }, { status: 404 })
    }

    return NextResponse.json(shortLink)
  } catch (error) {
    logger.error('更新短链接失败:', error)
    return NextResponse.json({ error: '更新短链接失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/shortlinks/[id] - 删除短链接
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const { id } = await params

  try {
    const success = await ShortLinkService.delete(id)
    if (!success) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('删除短链接失败:', error)
    return NextResponse.json({ error: '删除短链接失败' }, { status: 500 })
  }
}
