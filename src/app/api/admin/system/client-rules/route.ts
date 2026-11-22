import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  addCustomClientRule,
  deleteCustomClientRule,
  getCustomClientRules,
} from '@/modules/record/client-rule.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import type { CustomClientRule } from '@/shared/admin.types'

export const runtime = 'edge'

const ALLOWED_RULE_TARGETS = new Set<CustomClientRule['target']>([
  'clash',
  'singbox',
  'v2rayng',
  'browser',
])

export const GET = withAdminAuth('获取客户端 UA 规则', async () => {
  const rules = await getCustomClientRules()
  return jsonOk({ rules })
})

export const POST = withAdminAuth('新增客户端 UA 规则', async (request) => {
  const body = await parseJsonBody<{ keyword?: unknown; target?: unknown; note?: unknown }>(request)
  if (!body?.keyword || typeof body.keyword !== 'string' || !body.keyword.trim()) {
    throw AppError.validation('请提供要匹配的 User-Agent 关键词', 'keyword')
  }

  if (
    typeof body.target !== 'string' ||
    !ALLOWED_RULE_TARGETS.has(body.target as CustomClientRule['target'])
  ) {
    throw AppError.validation('请选择有效的输出格式（clash / singbox / v2rayng / browser）', 'target')
  }

  const { rule, rules } = await addCustomClientRule({
    keyword: body.keyword,
    target: body.target as CustomClientRule['target'],
    note: typeof body.note === 'string' ? body.note : undefined,
  })

  return jsonOk({ rule, rules })
})

export const DELETE = withAdminAuth('删除客户端 UA 规则', async (request) => {
  const body = await parseJsonBody<{ id?: unknown }>(request)
  if (!body?.id || typeof body.id !== 'string') {
    throw AppError.validation('请提供要删除的规则 ID', 'id')
  }

  const rules = await deleteCustomClientRule(body.id)
  if (!rules) {
    throw AppError.notFound('规则不存在', { id: body.id })
  }

  return jsonOk({ rules })
})
