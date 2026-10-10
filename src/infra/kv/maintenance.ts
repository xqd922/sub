import { KV_PREFIX } from '@/infra/kv/types'
import { getKV } from '@/infra/kv/store'
import { listKeysByPrefix } from '@/infra/kv/operations'
import { logger } from '@/infra/logger'

const SHORT_INDEX_KEY = 'index:shortlinks'

export interface RebuildIndexResult {
  recordIndexed: number
  shortIndexed: number
  recordRepaired: number
  shortRepaired: number
}

export async function pingKV(): Promise<{ ok: boolean; latencyMs: number }> {
  const kv = await getKV()
  if (!kv) return { ok: false, latencyMs: 0 }

  const startedAt = Date.now()

  try {
    const token = `ping-${startedAt}`
    await kv.put('admin:ping', token)
    const echoed = await kv.get('admin:ping')
    await kv.delete('admin:ping')

    return { ok: echoed === token, latencyMs: Date.now() - startedAt }
  } catch (error) {
    logger.error('[Maintenance] KV 连通性测试失败:', error)
    return { ok: false, latencyMs: Date.now() - startedAt }
  }
}

export async function rebuildIndexes(): Promise<RebuildIndexResult> {
  const kv = await getKV()
  if (!kv) {
    return { recordIndexed: 0, shortIndexed: 0, recordRepaired: 0, shortRepaired: 0 }
  }

  try {
    const recordKeys = await listKeysByPrefix(KV_PREFIX.RECORD)
    const recordIds = recordKeys.map(name => name.slice(KV_PREFIX.RECORD.length))

    const oldRecordData = await kv.get(KV_PREFIX.INDEX, 'json') as { ids?: string[] } | null
    const oldRecordIds = new Set(oldRecordData?.ids || [])
    const recordRepaired = recordIds.filter(id => !oldRecordIds.has(id)).length

    await kv.put(KV_PREFIX.INDEX, JSON.stringify({ ids: recordIds, updatedAt: Date.now() }))

    const shortKeys = await listKeysByPrefix(KV_PREFIX.SHORT)
    const shortIds = shortKeys
      .filter(name => name.startsWith(KV_PREFIX.SHORT) && !name.startsWith(`${KV_PREFIX.SHORT}url:`))
      .map(name => name.slice(KV_PREFIX.SHORT.length))

    const oldShortData = await kv.get(SHORT_INDEX_KEY, 'json') as { ids?: string[] } | null
    const oldShortIds = new Set(oldShortData?.ids || [])
    const shortRepaired = shortIds.filter(id => !oldShortIds.has(id)).length

    await kv.put(SHORT_INDEX_KEY, JSON.stringify({ ids: shortIds }))

    logger.info('[Maintenance] 索引重建完成', {
      recordIndexed: recordIds.length,
      shortIndexed: shortIds.length,
      recordRepaired,
      shortRepaired
    })

    return {
      recordIndexed: recordIds.length,
      shortIndexed: shortIds.length,
      recordRepaired,
      shortRepaired
    }
  } catch (error) {
    logger.error('[Maintenance] 索引重建失败:', error)
    throw error
  }
}
