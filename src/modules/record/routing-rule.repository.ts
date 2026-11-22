import { AppError, ErrorCode, ErrorSeverity } from '@/server/app-error'
import { getKvStore } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type {
  CustomRoutingRule,
  RoutingRuleAction,
  RoutingRuleType,
} from '@/shared/admin.types'

const MAX_ROUTING_RULES = 200

const ALLOWED_TYPES = new Set<RoutingRuleType>([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
])

const ALLOWED_ACTIONS = new Set<RoutingRuleAction>(['DIRECT', 'Manual', 'Emby', 'AI', 'REJECT'])

function normalizeRuleValue(type: RoutingRuleType, raw: string): string {
  const cleaned = raw.trim()
  if (!cleaned || cleaned.length > 128) {
    throw AppError.validation('规则内容长度需在 1-128 个字符之间', 'value')
  }
  if (/[\s,\r\n]/.test(cleaned)) {
    throw AppError.validation('规则内容不能包含空格、逗号或换行符', 'value')
  }
  if (type === 'IP-CIDR') {
    if (!cleaned.includes('/')) {
      return cleaned.includes(':') ? `${cleaned}/128` : `${cleaned}/32`
    }
    return cleaned
  }
  return cleaned.replace(/^\.+/, '').toLowerCase()
}

export function parseCustomRoutingRules(data: unknown): CustomRoutingRule[] {
  const rules = (data as { rules?: CustomRoutingRule[] } | null)?.rules
  if (!Array.isArray(rules)) return []
  return rules.filter(
    (item): item is CustomRoutingRule =>
      Boolean(
        item &&
          typeof item.id === 'string' &&
          ALLOWED_TYPES.has(item.type) &&
          typeof item.value === 'string' &&
          item.value.trim() &&
          ALLOWED_ACTIONS.has(item.action),
      ),
  )
}

export async function getCustomRoutingRules(): Promise<CustomRoutingRule[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const data = await kv.get(KV_KEYS.ROUTING_RULES, 'json')
    return parseCustomRoutingRules(data)
  } catch (error) {
    logger.warn('[RoutingRuleRepo] 读取自定义分流规则失败:', error)
    return []
  }
}

async function saveCustomRoutingRules(rules: CustomRoutingRule[]): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    await kv.put(KV_KEYS.ROUTING_RULES, JSON.stringify({ rules }))
    return true
  } catch (error) {
    logger.error('[RoutingRuleRepo] 保存自定义分流规则失败:', error)
    return false
  }
}

export async function addCustomRoutingRule(input: {
  type: RoutingRuleType
  value: string
  action: RoutingRuleAction
  note?: string
}): Promise<{ rule: CustomRoutingRule; rules: CustomRoutingRule[] }> {
  if (!ALLOWED_TYPES.has(input.type)) {
    throw AppError.validation('不支持的规则类型', 'type')
  }
  if (!ALLOWED_ACTIONS.has(input.action)) {
    throw AppError.validation('不支持的目标策略', 'action')
  }

  const value = normalizeRuleValue(input.type, input.value)
  const existing = await getCustomRoutingRules()
  if (existing.length >= MAX_ROUTING_RULES) {
    throw AppError.validation(`最多配置 ${MAX_ROUTING_RULES} 条自定义分流规则`)
  }

  const lowerVal = value.toLowerCase()
  if (existing.some((r) => r.type === input.type && r.value.toLowerCase() === lowerVal)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `规则 "${input.type},${value}" 已存在，请先删除旧规则再重建`,
      409,
      ErrorSeverity.LOW,
    )
  }

  const rule: CustomRoutingRule = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    value,
    action: input.action,
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 120) } : {}),
    createdAt: Date.now(),
  }

  const nextRules = [rule, ...existing]
  const saved = await saveCustomRoutingRules(nextRules)
  if (!saved) {
    throw AppError.serviceUnavailable('KV 存储不可用，无法保存分流规则')
  }

  return { rule, rules: nextRules }
}

export async function deleteCustomRoutingRule(id: string): Promise<CustomRoutingRule[] | null> {
  const existing = await getCustomRoutingRules()
  const nextRules = existing.filter((rule) => rule.id !== id)
  if (nextRules.length === existing.length) {
    return null
  }

  const saved = await saveCustomRoutingRules(nextRules)
  if (!saved) {
    throw AppError.serviceUnavailable('KV 存储不可用，无法更新分流规则')
  }

  return nextRules
}
