import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { getAllShortLinks, createShortLink, deleteShortLink } from '@/infra/kv/short_link'
import { logger } from '@/infra/logger'

export const runtime = 'edge'

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  try {
    const shortLinks = await getAllShortLinks()
    return NextResponse.json({ success: true, shortLinks })
  } catch (error) {
    logger.error('[Admin] 获取短链接失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const body = await parseJsonBody<{ targetUrl?: string }>(request)
  if (!body?.targetUrl || typeof body.targetUrl !== 'string') {
    return NextResponse.json(AppError.validation('请提供目标链接', 'targetUrl').toResponse(), { status: 400 })
  }

  try {
    new URL(body.targetUrl)
  } catch {
    return NextResponse.json(AppError.validation('目标链接格式不正确', 'targetUrl', body.targetUrl).toResponse(), { status: 400 })
  }

  try {
    const shortLink = await createShortLink(body.targetUrl)
    if (!shortLink) {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, '存储不可用，无法创建短链接', 503, ErrorSeverity.MEDIUM)
      return NextResponse.json(error.toResponse(), { status: 503 })
    }
    return NextResponse.json({ success: true, shortLink })
  } catch (error) {
    logger.error('[Admin] 创建短链接失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const body = await parseJsonBody<{ ids?: string[] }>(request)
  if (!Array.isArray(body?.ids) || body.ids.length === 0 || typeof body.ids[0] !== 'string') {
    return NextResponse.json(AppError.validation('请提供要删除的短链接 ID 列表', 'ids').toResponse(), { status: 400 })
  }

  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const deleted = await deleteShortLink(id)
    if (deleted) {
      succeeded.push(id)
    } else {
      failed.push(id)
    }
  }

  return NextResponse.json({ success: true, succeeded, failed })
}
