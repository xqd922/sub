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

  if (!adminToken) {
    return false
  }

  return token === adminToken
}

/**
 * GET /api/admin/stats - 获取统计数据
 */
export async function GET(request: Request) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const stats = await RecordService.getStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('获取统计失败:', error)
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
