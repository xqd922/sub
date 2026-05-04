import { NextResponse } from 'next/server'
import { RecordService } from '@/src/infrastructure/storage/kv'
import { requireAuth } from '@/src/infrastructure/auth'
import { logger } from '@/src/infrastructure/logger'


/**
 * GET /api/admin/stats - 获取统计数据
 */
export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  try {
    const stats = await RecordService.getStats()
    return NextResponse.json(stats)
  } catch (error) {
    logger.error('获取统计失败:', error)
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
