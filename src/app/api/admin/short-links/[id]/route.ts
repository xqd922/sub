import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { updateShortLink, deleteShortLink } from '@/infra/kv/short_link'
import { logger } from '@/infra/logger'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const { id } = await params

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(AppError.validation('请求体格式错误').toResponse(), { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json(AppError.validation('请提供新名称', 'name').toResponse(), { status: 400 })
  }

  try {
    const shortLink = await updateShortLink(id, { name: body.name })
    if (!shortLink) {
      const error = new AppError(ErrorCode.NOT_FOUND, '短链接不存在', 404, ErrorSeverity.LOW, { id })
      return NextResponse.json(error.toResponse(), { status: 404 })
    }

    return NextResponse.json({ success: true, shortLink })
  } catch (error) {
    logger.error('[Admin] 更新短链接失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const { id } = await params

  try {
    const deleted = await deleteShortLink(id)
    if (!deleted) {
      const error = new AppError(ErrorCode.NOT_FOUND, '短链接不存在', 404, ErrorSeverity.LOW, { id })
      return NextResponse.json(error.toResponse(), { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Admin] 删除短链接失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}
