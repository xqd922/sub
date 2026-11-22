import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  deleteRecordPermanently,
  getRecordById,
  setRecordEnabled,
  updateRecord,
} from '@/modules/record/record.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'

export const runtime = 'edge'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const PATCH = withAdminAuth<RouteContext>('更新记录', async (request, { params }) => {
  const { id } = await params
  const body = await parseJsonBody<{ name?: unknown; enabled?: unknown }>(request)
  if (!body) {
    throw AppError.validation('请求体格式错误')
  }

  const hasName = body.name !== undefined
  const hasEnabled = body.enabled !== undefined
  if (!hasName && !hasEnabled) {
    throw AppError.validation('请提供要更新的字段（name 或 enabled）')
  }
  if (hasName && typeof body.name !== 'string') {
    throw AppError.validation('名称必须是字符串', 'name')
  }
  if (hasEnabled && typeof body.enabled !== 'boolean') {
    throw AppError.validation('enabled 必须是布尔值', 'enabled')
  }

  let record = hasEnabled
    ? await setRecordEnabled(id, body.enabled as boolean)
    : await getRecordById(id)

  if (!record) {
    throw AppError.notFound('记录不存在', { id })
  }

  if (hasName) {
    record = (await updateRecord(id, { name: body.name as string })) || record
  }

  return jsonOk({ record })
})

export const DELETE = withAdminAuth<RouteContext>('删除记录', async (_request, { params }) => {
  const { id } = await params
  const deleted = await deleteRecordPermanently(id)
  if (!deleted) {
    throw AppError.notFound('记录不存在', { id })
  }

  return jsonOk({})
})
