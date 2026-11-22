import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  createShortLink,
  deleteShortLink,
  getAllShortLinks,
  updateShortLink,
} from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import {
  isAllowedSubscriptionInput,
  isValidCustomSlug,
  unwrapConversionUrl,
} from '@/shared/url.utils'

export const runtime = 'edge'

function normalizeShortTarget(rawUrl: string): string {
  const { subscriptionUrl, target } = unwrapConversionUrl(rawUrl)
  if (!isAllowedSubscriptionInput(subscriptionUrl)) {
    throw AppError.validation('目标链接格式不正确（需为 HTTP(S) 或支持的代理协议）', 'targetUrl')
  }
  return target && target !== 'auto'
    ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
    : subscriptionUrl
}

export const GET = withAdminAuth('获取短链接', async () => {
  const shortLinks = await getAllShortLinks()
  return jsonOk({ shortLinks })
})

export const POST = withAdminAuth('创建短链接', async (request) => {
  const body = await parseJsonBody<{
    targetUrl?: unknown
    name?: unknown
    slug?: unknown
    comment?: unknown
    disabled?: unknown
    expiresAt?: unknown
    maxHits?: unknown
    password?: unknown
  }>(request)

  if (!body?.targetUrl || typeof body.targetUrl !== 'string') {
    throw AppError.validation('请提供目标链接', 'targetUrl')
  }

  const normalizedTarget = normalizeShortTarget(body.targetUrl)

  let slug: string | undefined
  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (typeof body.slug !== 'string' || !isValidCustomSlug(body.slug)) {
      throw AppError.validation('自定义短码仅支持 2-32 位字母、数字、连字符或下划线', 'slug')
    }
    slug = body.slug.trim()
  }

  let expiresAt: number | null | undefined
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '') {
    const parsed = Number(body.expiresAt)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw AppError.validation('过期时间格式不正确', 'expiresAt')
    }
    expiresAt = parsed
  }

  let maxHits: number | null | undefined
  if (body.maxHits !== undefined && body.maxHits !== null && body.maxHits !== '') {
    const parsed = Number(body.maxHits)
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw AppError.validation('访问次数上限必须是大于等于 1 的整数', 'maxHits')
    }
    maxHits = Math.floor(parsed)
  }

  const shortLink = await createShortLink({
    targetUrl: normalizedTarget,
    name: typeof body.name === 'string' ? body.name.trim() || undefined : undefined,
    slug,
    comment: typeof body.comment === 'string' ? body.comment.trim() || undefined : undefined,
    disabled: typeof body.disabled === 'boolean' ? body.disabled : undefined,
    expiresAt,
    maxHits,
    password: typeof body.password === 'string' ? body.password.trim() || undefined : undefined,
  })

  if (!shortLink) {
    throw AppError.serviceUnavailable('存储不可用，无法创建短链接')
  }

  return jsonOk({ shortLink })
})

export const PATCH = withAdminAuth('批量更新短链接', async (request) => {
  const body = await parseJsonBody<{ ids?: unknown[]; action?: string }>(request)
  if (
    !Array.isArray(body?.ids) ||
    body.ids.length === 0 ||
    !body.ids.every((id): id is string => typeof id === 'string')
  ) {
    throw AppError.validation('请提供要操作的短链接 ID 列表', 'ids')
  }

  if (body.action !== 'enable' && body.action !== 'disable') {
    throw AppError.validation('不支持的批量操作类型', 'action')
  }

  const disabled = body.action === 'disable'
  const succeeded: string[] = []
  const failed: string[] = []

  for (const id of body.ids) {
    const updated = await updateShortLink(id, { disabled })
    if (updated) succeeded.push(id)
    else failed.push(id)
  }

  return jsonOk({ succeeded, failed })
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
