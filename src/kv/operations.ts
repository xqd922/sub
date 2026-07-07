import { ConvertRecord, RecordIndex, DailyStats, KV_PREFIX } from '@/kv/types'
import { getKV } from '@/kv/store'
import { logger } from '@/lib/logger'

export async function isAvailable(): Promise<boolean> {
  const kv = await getKV()
  return kv !== null
}

export async function getRecord(id: string): Promise<ConvertRecord | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const data = await kv.get(`${KV_PREFIX.RECORD}${id}`, 'json')
    return data as ConvertRecord | null
  } catch (error) {
    logger.error('[KV] 获取记录失败:', error)
    return null
  }
}

export async function saveRecord(record: ConvertRecord): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    await kv.put(
      `${KV_PREFIX.RECORD}${record.id}`,
      JSON.stringify(record),
      { expirationTtl: 86400 * 365 } 
    )
    return true
  } catch (error) {
    logger.error('[KV] 保存记录失败:', error)
    return false
  }
}

export async function deleteRecordById(id: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    await kv.delete(`${KV_PREFIX.RECORD}${id}`)
    return true
  } catch (error) {
    logger.error('[KV] 删除记录失败:', error)
    return false
  }
}

export async function getIndex(): Promise<RecordIndex> {
  const kv = await getKV()
  if (!kv) return { ids: [], updatedAt: Date.now() }

  try {
    const data = await kv.get(KV_PREFIX.INDEX, 'json')
    return (data as RecordIndex) || { ids: [], updatedAt: Date.now() }
  } catch (error) {
    logger.error('[KV] 获取索引失败:', error)
    return { ids: [], updatedAt: Date.now() }
  }
}

export async function updateIndex(index: RecordIndex): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    await kv.put(KV_PREFIX.INDEX, JSON.stringify(index))
    return true
  } catch (error) {
    logger.error('[KV] 更新索引失败:', error)
    return false
  }
}

export async function addToIndex(id: string): Promise<boolean> {
  const index = await getIndex()
  if (!index.ids.includes(id)) {
    index.ids.push(id)
    index.updatedAt = Date.now()
    return updateIndex(index)
  }
  return true
}

export async function removeFromIndex(id: string): Promise<boolean> {
  const index = await getIndex()
  const idx = index.ids.indexOf(id)
  if (idx > -1) {
    index.ids.splice(idx, 1)
    index.updatedAt = Date.now()
    return updateIndex(index)
  }
  return true
}

export async function getAllRecords(): Promise<ConvertRecord[]> {
  const index = await getIndex()

  const recordPromises = index.ids.map(id => getRecord(id))
  const recordResults = await Promise.all(recordPromises)

  const records = recordResults.filter((r): r is ConvertRecord => r !== null)

  return records.sort((a, b) => b.lastAccess - a.lastAccess)
}

export async function getDailyStats(date: string): Promise<DailyStats | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const data = await kv.get(`${KV_PREFIX.DAILY}${date}`, 'json')
    return data as DailyStats | null
  } catch (error) {
    logger.error('[KV] 获取每日统计失败:', error)
    return null
  }
}

export async function incrementDailyHits(recordId: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    const today = new Date().toISOString().slice(0, 10)
    const key = `${KV_PREFIX.DAILY}${today}`

    const current = await getDailyStats(today)
    const todayUrlsKey = `${KV_PREFIX.DAILY}${today}:urls`
    const urlsData = await kv.get(todayUrlsKey, 'json') as { ids: string[] } | null
    const visitedUrls = new Set(urlsData?.ids || [])

    const stats: DailyStats = {
      date: today,
      totalHits: (current?.totalHits || 0) + 1,
      uniqueUrls: visitedUrls.has(recordId) ? (current?.uniqueUrls || 0) : (current?.uniqueUrls || 0) + 1
    }

    if (!visitedUrls.has(recordId)) {
      visitedUrls.add(recordId)
      await kv.put(todayUrlsKey, JSON.stringify({ ids: Array.from(visitedUrls) }), {
        expirationTtl: 86400 * 2 
      })
    }

    await kv.put(key, JSON.stringify(stats), {
      expirationTtl: 86400 * 30 
    })

    return true
  } catch (error) {
    logger.error('[KV] 更新每日统计失败:', error)
    return false
  }
}
