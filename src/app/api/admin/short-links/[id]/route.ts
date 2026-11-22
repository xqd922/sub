import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { deleteShortLink, updateShortLink } from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/errors/app-error'
import { jsonOk, parseJsonBody } from '@/server/http/route.utils'

export const runtime = 'edge'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const PATCH = withAdminAuth<RouteContext>('更新短链接', async (request, { params }) => {
  const { id } = await params
  const body = await parseJsonBody<{ name?: unknown }>(request)
  if (!body) {
    throw AppError.validation('请求体格式错误')
  }
  if (!body.name || typeof body.name !== 'string') {
    throw AppError.validation('请提供新名称', 'name')
  }

  const shortLink = await updateShortLink(id, { name: body.name })
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
