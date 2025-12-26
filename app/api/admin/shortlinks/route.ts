import { NextResponse } from 'next/server'
import { ShortLinkService } from '@/lib/kv'
import { validateAdminAuth } from '@/lib/auth'

export const runtime = 'edge'

/**
 * GET /api/admin/shortlinks - 获取所有短链接
 */
export async function GET(request: Request) {
  if (!(await validateAdminAuth(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const shortLinks = await ShortLinkService.getAll()
    return NextResponse.json({ shortLinks, total: shortLinks.length })
  } catch (error) {
    console.error('获取短链接失败:', error)
    return NextResponse.json({ error: '获取短链接失败' }, { status: 500 })
  }
}
