import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  addCustomRoutingRule,
  deleteCustomRoutingRule,
  getCustomRoutingRules,
} from '@/modules/record/routing-rule.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import type { RoutingRuleAction, RoutingRuleType } from '@/shared/admin.types'

export const runtime = 'edge'

export const GET = withAdminAuth('获取分流规则', async () => {
  const rules = await getCustomRoutingRules()
  return jsonOk({ rules })
})

export const POST = withAdminAuth('新增分流规则', async (request) => {
  const body = await parseJsonBody<{
    type?: unknown
    value?: unknown
    action?: unknown
    note?: unknown
  }>(request)

  if (!body?.type || typeof body.type !== 'string') {
    throw AppError.validation('请选择规则匹配类型', 'type')
  }
  if (!body?.value || typeof body.value !== 'string' || !body.value.trim()) {
    throw AppError.validation('请提供域名、关键词或 IP 网段', 'value')
  }
  if (!body?.action || typeof body.action !== 'string') {
    throw AppError.validation('请选择目标策略', 'action')
  }

  const { rule, rules } = await addCustomRoutingRule({
    type: body.type as RoutingRuleType,
    value: body.value,
    action: body.action as RoutingRuleAction,
    note: typeof body.note === 'string' ? body.note : undefined,
  })

  return jsonOk({ rule, rules })
})

export const DELETE = withAdminAuth('删除分流规则', async (request) => {
  const body = await parseJsonBody<{ id?: unknown }>(request)
  if (!body?.id || typeof body.id !== 'string') {
    throw AppError.validation('请提供要删除的规则 ID', 'id')
  }

  const rules = await deleteCustomRoutingRule(body.id)
  if (!rules) {
    throw AppError.notFound('规则不存在', { id: body.id })
  }

  return jsonOk({ rules })
})
