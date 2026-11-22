import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { deleteShortLink, updateShortLink } from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import { isAllowedSubscriptionInput, unwrapConversionUrl } from '@/shared/url.utils'

export const runtime = 'edge'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const PATCH = withAdminAuth<RouteContext>('更新短链接', async (request, { params }) => {
  const { id } = await params
  const body = await parseJsonBody<{ name?: unknown; targetUrl?: unknown }>(request)
  if (!body) {
    throw AppError.validation('请求体格式错误')
  }

  const hasName = body.name !== undefined
  const hasTargetUrl = body.targetUrl !== undefined
  if (!hasName && !hasTargetUrl) {
    throw AppError.validation('请提供要更新的字段（name 或 targetUrl）')
  }
  if (hasName && (typeof body.name !== 'string' || !body.name.trim())) {
    throw AppError.validation('名称必须是非空字符串', 'name')
  }

  let normalizedTargetUrl: string | undefined
  if (hasTargetUrl) {
    if (typeof body.targetUrl !== 'string' || !body.targetUrl.trim()) {
      throw AppError.validation('目标链接必须是非空字符串', 'targetUrl')
    }
    const { subscriptionUrl, target } = unwrapConversionUrl(body.targetUrl)
    if (!isAllowedSubscriptionInput(subscriptionUrl)) {
      throw AppError.validation('目标链接格式不正确', 'targetUrl')
    }
    normalizedTargetUrl =
      target && target !== 'auto'
        ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
        : subscriptionUrl
  }

  const shortLink = await updateShortLink(id, {
    ...(hasName ? { name: (body.name as string).trim() } : {}),
    ...(normalizedTargetUrl !== undefined ? { targetUrl: normalizedTargetUrl } : {}),
  })

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
