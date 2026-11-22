import { AppError, ErrorCode, ErrorSeverity } from '@/server/app-error'
import { getKvStore } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { CustomClientRule } from '@/shared/admin.types'

const MAX_CUSTOM_RULES = 100

export function parseCustomClientRules(data: unknown): CustomClientRule[] {
  const rules = (data as { rules?: CustomClientRule[] } | null)?.rules
  if (!Array.isArray(rules)) return []
  return rules.filter(
    (item): item is CustomClientRule =>
      Boolean(item && typeof item.id === 'string' && typeof item.keyword === 'string'),
  )
}

export async function getCustomClientRules(): Promise<CustomClientRule[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const data = await kv.get(KV_KEYS.CLIENT_RULES, 'json')
    return parseCustomClientRules(data)
  } catch (error) {
    logger.warn('[ClientRuleRepo] 读取自定义 UA 规则失败:', error)
    return []
  }
}

async function saveCustomClientRules(rules: CustomClientRule[]): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    await kv.put(KV_KEYS.CLIENT_RULES, JSON.stringify({ rules }))
    return true
  } catch (error) {
    logger.error('[ClientRuleRepo] 保存自定义 UA 规则失败:', error)
    return false
  }
}

export async function addCustomClientRule(input: {
  keyword: string
  target: CustomClientRule['target']
  note?: string
}): Promise<{ rule: CustomClientRule; rules: CustomClientRule[] }> {
  const keyword = input.keyword.trim()
  if (!keyword || keyword.length > 64) {
    throw AppError.validation('关键词长度需在 1-64 个字符之间', 'keyword')
  }

  const existing = await getCustomClientRules()
  if (existing.length >= MAX_CUSTOM_RULES) {
    throw AppError.validation(`最多配置 ${MAX_CUSTOM_RULES} 条自定义规则`)
  }

  const lower = keyword.toLowerCase()
  if (existing.some((rule) => rule.keyword.toLowerCase() === lower)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `关键词 "${keyword}" 已存在，请先删除旧规则再重建`,
      409,
      ErrorSeverity.LOW,
    )
  }

  const rule: CustomClientRule = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    keyword,
    target: input.target,
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 120) } : {}),
    createdAt: Date.now(),
  }

  const nextRules = [rule, ...existing]
  const saved = await saveCustomClientRules(nextRules)
  if (!saved) {
    throw AppError.serviceUnavailable('KV 存储不可用，无法保存规则')
  }

  return { rule, rules: nextRules }
}

export async function deleteCustomClientRule(id: string): Promise<CustomClientRule[] | null> {
  const existing = await getCustomClientRules()
  const nextRules = existing.filter((rule) => rule.id !== id)
  if (nextRules.length === existing.length) {
    return null
  }

  const saved = await saveCustomClientRules(nextRules)
  if (!saved) {
    throw AppError.serviceUnavailable('KV 存储不可用，无法更新规则')
  }

  return nextRules
}
