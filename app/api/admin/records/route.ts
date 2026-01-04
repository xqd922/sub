import { NextResponse } from 'next/server'
import { RecordService } from '@/lib/kv'
import { validateAdminAuth } from '@/lib/auth'

export const runtime = 'edge'

/**
 * GET /api/admin/records - 获取记录（支持分页）
 *
 * Query params:
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 20，最大 100）
 * - search: 搜索关键词
 * - sortBy: 排序字段（lastAccess, hits, nodeCount, createdAt）
 * - sortOrder: 排序方向（asc, desc）
 */
export async function GET(request: Request) {
  if (!(await validateAdminAuth(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')))
    const search = url.searchParams.get('search') || ''
    const sortBy = (url.searchParams.get('sortBy') || 'lastAccess') as 'lastAccess' | 'hits' | 'nodeCount' | 'createdAt'
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const result = await RecordService.getRecordsPaginated({
      page,
      pageSize,
      search,
      sortBy,
      sortOrder
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('获取记录失败:', error)
    return NextResponse.json({ error: '获取记录失败' }, { status: 500 })
  }
}
