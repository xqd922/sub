import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { getRecord, updateRecord, setRecordEnabled, deleteRecordPermanently } from '@/infra/kv/records'
import type { ConvertRecord } from '@/infra/kv/types'
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

  let body: { name?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(AppError.validation('请求体格式错误').toResponse(), { status: 400 })
  }

  const hasName = body.name !== undefined
  const hasEnabled = body.enabled !== undefined
  if (!hasName && !hasEnabled) {
    return NextResponse.json(AppError.validation('请提供要更新的字段（name 或 enabled）').toResponse(), { status: 400 })
  }
  if (hasName && typeof body.name !== 'string') {
    return NextResponse.json(AppError.validation('名称必须是字符串', 'name').toResponse(), { status: 400 })
  }

  try {
    let record: ConvertRecord | null = null

    if (hasEnabled) {
      record = await setRecordEnabled(id, body.enabled as boolean)
    } else {
      record = await getRecord(id)
    }

    if (!record) {
      const error = new AppError(ErrorCode.NOT_FOUND, '记录不存在', 404, ErrorSeverity.LOW, { id })
      return NextResponse.json(error.toResponse(), { status: 404 })
    }

    if (hasName) {
      record = (await updateRecord(id, { name: body.name as string })) || record
    }

    return NextResponse.json({ success: true, record })
  } catch (error) {
    logger.error('[Admin] 更新记录失败:', error)
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
    const deleted = await deleteRecordPermanently(id)
    if (!deleted) {
      const error = new AppError(ErrorCode.NOT_FOUND, '记录不存在', 404, ErrorSeverity.LOW, { id })
      return NextResponse.json(error.toResponse(), { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Admin] 删除记录失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}
