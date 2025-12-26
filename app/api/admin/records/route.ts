import { NextResponse } from 'next/server'
import { RecordService } from '@/lib/kv'
import { validateAdminAuth } from '@/lib/auth'

export const runtime = 'edge'

/**
 * GET /api/admin/records - 获取所有记录
 */
export async function GET(request: Request) {
  if (!(await validateAdminAuth(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const records = await RecordService.getAllRecords()
    return NextResponse.json({ records, total: records.length })
  } catch (error) {
    console.error('获取记录失败:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}
