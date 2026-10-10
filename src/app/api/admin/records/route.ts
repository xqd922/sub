import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { listAllRecordsForAdmin, createRecordManually, setRecordEnabled, deleteRecordPermanently } from '@/infra/kv/records'
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
    const records = await listAllRecordsForAdmin()
    return NextResponse.json({ success: true, records })
  } catch (error) {
    logger.error('[Admin] 获取转换记录失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const body = await parseJsonBody<{ url?: string; name?: string }>(request)
  if (!body?.url || typeof body.url !== 'string') {
    return NextResponse.json(AppError.validation('请提供订阅链接', 'url').toResponse(), { status: 400 })
  }

  try {
    new URL(body.url)
  } catch {
    return NextResponse.json(AppError.validation('订阅链接格式不正确', 'url', body.url).toResponse(), { status: 400 })
  }

  try {
    const record = await createRecordManually(body.url, body.name)
    if (!record) {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, '存储不可用，无法登记订阅', 503, ErrorSeverity.MEDIUM)
      return NextResponse.json(error.toResponse(), { status: 503 })
    }
    return NextResponse.json({ success: true, record })
  } catch (error) {
    logger.error('[Admin] 登记订阅失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const body = await parseJsonBody<{ ids?: string[]; action?: string }>(request)
  if (!Array.isArray(body?.ids) || body.ids.length === 0 || typeof body.ids[0] !== 'string') {
    return NextResponse.json(AppError.validation('请提供要操作的记录 ID 列表', 'ids').toResponse(), { status: 400 })
  }
  if (body.action !== 'enable' && body.action !== 'disable') {
    return NextResponse.json(AppError.validation('action 仅支持 enable 或 disable', 'action').toResponse(), { status: 400 })
  }

  const enabled = body.action === 'enable'
  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const record = await setRecordEnabled(id, enabled)
    if (record) {
      succeeded.push(id)
    } else {
      failed.push(id)
    }
  }

  return NextResponse.json({ success: true, succeeded, failed })
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  const body = await parseJsonBody<{ ids?: string[] }>(request)
  if (!Array.isArray(body?.ids) || body.ids.length === 0 || typeof body.ids[0] !== 'string') {
    return NextResponse.json(AppError.validation('请提供要删除的记录 ID 列表', 'ids').toResponse(), { status: 400 })
  }

  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const deleted = await deleteRecordPermanently(id)
    if (deleted) {
      succeeded.push(id)
    } else {
      failed.push(id)
    }
  }

  return NextResponse.json({ success: true, succeeded, failed })
}
