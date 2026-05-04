import { NextResponse } from 'next/server'
import { RecordService } from '@/src/infrastructure/storage/kv'
import { requireAuth } from '@/src/infrastructure/auth'
import { logger } from '@/src/infrastructure/logger'


/**
 * GET /api/admin/records - 获取所有记录
 */
export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  try {
    const records = await RecordService.getAllRecords()
    return NextResponse.json({ records, total: records.length })
  } catch (error) {
    logger.error('获取记录失败:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}
