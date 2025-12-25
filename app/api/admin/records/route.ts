import { NextResponse } from 'next/server'
import { RecordService } from '@/lib/kv'

export const runtime = 'edge'

/**
 * 验证管理员 Token
 */
function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const adminToken = process.env.ADMIN_TOKEN

  // 如果没有配置 ADMIN_TOKEN，禁止访问
  if (!adminToken) {
    return false
  }

  return token === adminToken
}

/**
 * GET /api/admin/records - 获取所有记录
 */
export async function GET(request: Request) {
  if (!validateAuth(request)) {
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
