import { NextResponse } from 'next/server'
import { ShortLinkService } from '@/lib/kv'
import { validateAdminAuth } from '@/lib/auth'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/admin/shortlinks/[id] - 删除短链接
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  if (!(await validateAdminAuth(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  try {
    const success = await ShortLinkService.delete(id)
    if (!success) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除短链接失败:', error)
    return NextResponse.json({ error: '删除短链接失败' }, { status: 500 })
  }
}
