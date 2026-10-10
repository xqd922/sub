import { NextResponse } from 'next/server'
import { AppError } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { getStats, getRecentDailyStats } from '@/infra/kv/index'
import { logger } from '@/infra/logger'

export const runtime = 'edge'

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  try {
    const [stats, daily] = await Promise.all([getStats(), getRecentDailyStats(30)])
    return NextResponse.json({ success: true, stats, daily })
  } catch (error) {
    logger.error('[Admin] 获取统计失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}
