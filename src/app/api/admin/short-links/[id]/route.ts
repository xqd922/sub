import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { deleteShortLink, updateShortLink } from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import type { TargetClientOverride, UpdateShortLinkInput } from '@/shared/admin.types'
import { isAllowedSubscriptionInput, unwrapConversionUrl } from '@/shared/url.utils'

export const runtime = 'edge'

const VALID_TARGETS = new Set<TargetClientOverride>(['auto', 'clash', 'singbox', 'v2rayng', 'browser'])

interface RouteContext {
  params: Promise<{ id: string }>
}

export const PATCH = withAdminAuth<RouteContext>('更新短链接', async (request, { params }) => {
  const { id } = await params
  const body = await parseJsonBody<{
    name?: unknown
    targetUrl?: unknown
    comment?: unknown
    disabled?: unknown
    expiresAt?: unknown
    maxHits?: unknown
    password?: unknown
    defaultTarget?: unknown
  }>(request)

  if (!body) {
    throw AppError.validation('请求体格式错误')
  }

  const updates: UpdateShortLinkInput = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw AppError.validation('名称必须是非空字符串', 'name')
    }
    updates.name = body.name.trim()
  }

  if (body.targetUrl !== undefined) {
    if (typeof body.targetUrl !== 'string' || !body.targetUrl.trim()) {
      throw AppError.validation('目标链接必须是非空字符串', 'targetUrl')
    }
    const { subscriptionUrl, target } = unwrapConversionUrl(body.targetUrl)
    if (!isAllowedSubscriptionInput(subscriptionUrl)) {
      throw AppError.validation('目标链接格式不正确', 'targetUrl')
    }
    updates.targetUrl =
      target && target !== 'auto'
        ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
        : subscriptionUrl
  }

  if (body.comment !== undefined) {
    if (body.comment !== null && typeof body.comment !== 'string') {
      throw AppError.validation('备注必须是字符串', 'comment')
    }
    updates.comment = body.comment === null ? null : body.comment.trim() || null
  }

  if (body.disabled !== undefined) {
    if (typeof body.disabled !== 'boolean') {
      throw AppError.validation('启用状态必须是布尔值', 'disabled')
    }
    updates.disabled = body.disabled
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === '') {
      updates.expiresAt = null
    } else {
      const parsed = Number(body.expiresAt)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw AppError.validation('过期时间格式不正确', 'expiresAt')
      }
      updates.expiresAt = parsed
    }
  }

  if (body.maxHits !== undefined) {
    if (body.maxHits === null || body.maxHits === '') {
      updates.maxHits = null
    } else {
      const parsed = Number(body.maxHits)
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw AppError.validation('访问次数上限必须是大于等于 1 的整数', 'maxHits')
      }
      updates.maxHits = Math.floor(parsed)
    }
  }

  if (body.password !== undefined) {
    if (body.password !== null && typeof body.password !== 'string') {
      throw AppError.validation('访问密钥必须是字符串', 'password')
    }
    updates.password = body.password === null ? null : body.password.trim() || null
  }

  if (body.defaultTarget !== undefined) {
    if (body.defaultTarget === null || body.defaultTarget === '' || body.defaultTarget === 'auto') {
      updates.defaultTarget = null
    } else if (
      typeof body.defaultTarget === 'string' &&
      VALID_TARGETS.has(body.defaultTarget as TargetClientOverride)
    ) {
      updates.defaultTarget = body.defaultTarget as TargetClientOverride
    } else {
      throw AppError.validation('默认输出格式不正确', 'defaultTarget')
    }
  }

  if (Object.keys(updates).length === 0) {
    throw AppError.validation('请提供要更新的字段')
  }

  const shortLink = await updateShortLink(id, updates)
  if (!shortLink) {
    throw AppError.notFound('短链接不存在', { id })
  }

  return jsonOk({ shortLink })
})

export const DELETE = withAdminAuth<RouteContext>('删除短链接', async (_request, { params }) => {
  const { id } = await params
  const deleted = await deleteShortLink(id)
  if (!deleted) {
    throw AppError.notFound('短链接不存在', { id })
  }

  return jsonOk({})
})
