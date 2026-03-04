import { NextResponse } from 'next/server'
import { RecordService } from '@/lib/kv'
import { validateAdminAuth } from '@/lib/auth'
import { logger } from '@/lib/core/logger'

export const runtime = 'edge'

/**
 * GET /api/admin/stats - 获取统计数据
 */
export async function GET(request: Request) {
  if (!(await validateAdminAuth(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const stats = await RecordService.getStats()
    return NextResponse.json(stats)
  } catch (error) {
    logger.error('获取统计失败:', error)
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
