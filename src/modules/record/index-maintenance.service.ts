import { getKvStore, listKeysByPrefix } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { RebuildIndexResult } from '@/shared/admin.types'

export async function rebuildKvIndexes(): Promise<RebuildIndexResult> {
  const kv = await getKvStore()
  if (!kv) {
    return { recordIndexed: 0, shortIndexed: 0, recordRepaired: 0, shortRepaired: 0 }
  }

  try {
    const [recordKeys, oldRecordData, shortKeys, oldShortData] = await Promise.all([
      listKeysByPrefix(KV_KEYS.RECORD_PREFIX),
      kv.get(KV_KEYS.RECORD_INDEX, 'json') as Promise<{ ids?: string[] } | null>,
      listKeysByPrefix(KV_KEYS.SHORT_PREFIX),
      kv.get(KV_KEYS.SHORT_INDEX, 'json') as Promise<{ ids?: string[] } | null>,
    ])

    const recordIds = recordKeys.map((name) => name.slice(KV_KEYS.RECORD_PREFIX.length))
    const oldRecordIds = new Set(oldRecordData?.ids || [])
    const recordRepaired = recordIds.filter((id) => !oldRecordIds.has(id)).length

    await kv.put(KV_KEYS.RECORD_INDEX, JSON.stringify({ ids: recordIds, updatedAt: Date.now() }))

    const shortIds = shortKeys
      .filter(
        (name) =>
          name.startsWith(KV_KEYS.SHORT_PREFIX) && !name.startsWith(KV_KEYS.SHORT_URL_PREFIX),
      )
      .map((name) => name.slice(KV_KEYS.SHORT_PREFIX.length))

    const oldShortIds = new Set(oldShortData?.ids || [])
    const shortRepaired = shortIds.filter((id) => !oldShortIds.has(id)).length

    await kv.put(KV_KEYS.SHORT_INDEX, JSON.stringify({ ids: shortIds }))

    const result: RebuildIndexResult = {
      recordIndexed: recordIds.length,
      shortIndexed: shortIds.length,
      recordRepaired,
      shortRepaired,
    }

    logger.info('[Maintenance] 索引重建完成', result)
    return result
  } catch (error) {
    logger.error('[Maintenance] 索引重建失败:', error)
    throw error
  }
}
