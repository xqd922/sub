import { NextResponse } from 'next/server'
import { RecordService } from '@/lib/kv'
import { requireAuth } from '@/lib/auth'
import { logger } from '@/lib/core/logger'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/records/[id] - 获取单条记录
 */
export async function GET(request: Request, { params }: RouteParams) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const { id } = await params

  try {
    const record = await RecordService.getRecord(id)
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (error) {
    logger.error('获取记录失败:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/records/[id] - 更新记录
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const { id } = await params

  try {
    const body = await request.json() as { name?: string }
    const { name } = body

    const updates: Record<string, unknown> = {}
    if (typeof name === 'string') updates.name = name

    const record = await RecordService.updateRecord(id, updates)
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error) {
    logger.error('更新记录失败:', error)
    return NextResponse.json({ error: '更新记录失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/records/[id] - 删除记录（软删除，链接将失效）
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const { id } = await params

  try {
    const success = await RecordService.deleteRecord(id)
    if (!success) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('删除记录失败:', error)
    return NextResponse.json({ error: '删除记录失败' }, { status: 500 })
  }
}
