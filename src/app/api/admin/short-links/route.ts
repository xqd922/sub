import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  createShortLink,
  deleteShortLink,
  getAllShortLinks,
} from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/errors/app-error'
import { jsonOk, parseJsonBody } from '@/server/http/route.utils'
import { isValidUrl } from '@/shared/utils/url.utils'

export const runtime = 'edge'

export const GET = withAdminAuth('获取短链接', async () => {
  const shortLinks = await getAllShortLinks()
  return jsonOk({ shortLinks })
})

export const POST = withAdminAuth('创建短链接', async (request) => {
  const body = await parseJsonBody<{ targetUrl?: string }>(request)
  if (!body?.targetUrl || typeof body.targetUrl !== 'string') {
    throw AppError.validation('请提供目标链接', 'targetUrl')
  }
  if (!isValidUrl(body.targetUrl)) {
    throw AppError.validation('目标链接格式不正确', 'targetUrl', body.targetUrl)
  }

  const shortLink = await createShortLink(body.targetUrl)
  if (!shortLink) {
    throw AppError.serviceUnavailable('存储不可用，无法创建短链接')
  }
  return jsonOk({ shortLink })
})

export const DELETE = withAdminAuth('批量删除短链接', async (request) => {
  const body = await parseJsonBody<{ ids?: unknown[] }>(request)
  if (
    !Array.isArray(body?.ids) ||
    body.ids.length === 0 ||
    !body.ids.every((id): id is string => typeof id === 'string')
  ) {
    throw AppError.validation('请提供要删除的短链接 ID 列表', 'ids')
  }

  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const deleted = await deleteShortLink(id)
    if (deleted) succeeded.push(id)
    else failed.push(id)
  }

  return jsonOk({ succeeded, failed })
})
