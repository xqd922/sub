import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  createRecordManually,
  deleteRecordPermanently,
  listAllRecordsForAdmin,
  setRecordEnabled,
} from '@/modules/record/record.repository'
import { AppError } from '@/server/errors/app-error'
import { jsonOk, parseJsonBody } from '@/server/http/route.utils'
import { isValidUrl } from '@/shared/utils/url.utils'

export const runtime = 'edge'

export const GET = withAdminAuth('获取转换记录', async () => {
  const records = await listAllRecordsForAdmin()
  return jsonOk({ records })
})

export const POST = withAdminAuth('登记订阅', async (request) => {
  const body = await parseJsonBody<{ url?: string; name?: string }>(request)
  if (!body?.url || typeof body.url !== 'string') {
    throw AppError.validation('请提供订阅链接', 'url')
  }
  if (!isValidUrl(body.url)) {
    throw AppError.validation('订阅链接格式不正确', 'url', body.url)
  }

  const record = await createRecordManually(body.url, body.name)
  if (!record) {
    throw AppError.serviceUnavailable('存储不可用，无法登记订阅')
  }
  return jsonOk({ record })
})

export const PATCH = withAdminAuth('批量更新记录', async (request) => {
  const body = await parseJsonBody<{ ids?: unknown[]; action?: string }>(request)
  if (
    !Array.isArray(body?.ids) ||
    body.ids.length === 0 ||
    !body.ids.every((id): id is string => typeof id === 'string')
  ) {
    throw AppError.validation('请提供要操作的记录 ID 列表', 'ids')
  }
  if (body.action !== 'enable' && body.action !== 'disable') {
    throw AppError.validation('action 仅支持 enable 或 disable', 'action')
  }

  const enabled = body.action === 'enable'
  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const record = await setRecordEnabled(id, enabled)
    if (record) succeeded.push(id)
    else failed.push(id)
  }

  return jsonOk({ succeeded, failed })
})

export const DELETE = withAdminAuth('批量删除记录', async (request) => {
  const body = await parseJsonBody<{ ids?: unknown[] }>(request)
  if (
    !Array.isArray(body?.ids) ||
    body.ids.length === 0 ||
    !body.ids.every((id): id is string => typeof id === 'string')
  ) {
    throw AppError.validation('请提供要删除的记录 ID 列表', 'ids')
  }

  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const deleted = await deleteRecordPermanently(id)
    if (deleted) succeeded.push(id)
    else failed.push(id)
  }

  return jsonOk({ succeeded, failed })
})
