import { getKvStore, isKvAvailable, listKeysByPrefix } from '@/server/kv/kv.client'
import { KV_KEYS, KV_TTL_SECONDS, type RecordIndex } from '@/server/kv/kv.types'
import { logger } from '@/server/logger/logger'
import type { ConvertRecord, DailyStats, StatsData } from '@/shared/types/admin.types'
import { extractNameFromUrl } from '@/shared/utils/url.utils'

export async function generateRecordId(url: string): Promise<string> {
  const data = new TextEncoder().encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return hashHex.slice(0, 12)
}

async function getRecordIndex(): Promise<RecordIndex> {
  const kv = await getKvStore()
  if (!kv) return { ids: [], updatedAt: Date.now() }

  try {
    const data = (await kv.get(KV_KEYS.RECORD_INDEX, 'json')) as RecordIndex | null
    return data || { ids: [], updatedAt: Date.now() }
  } catch (error) {
    logger.error('[RecordRepo] 获取索引失败:', error)
    return { ids: [], updatedAt: Date.now() }
  }
}

async function saveRecordIndex(index: RecordIndex): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    await kv.put(KV_KEYS.RECORD_INDEX, JSON.stringify(index))
    return true
  } catch (error) {
    logger.error('[RecordRepo] 更新索引失败:', error)
    return false
  }
}

async function addRecordToIndex(id: string): Promise<boolean> {
  const index = await getRecordIndex()
  if (!index.ids.includes(id)) {
    index.ids.push(id)
    index.updatedAt = Date.now()
    return saveRecordIndex(index)
  }
  return true
}

async function removeRecordFromIndex(id: string): Promise<boolean> {
  const index = await getRecordIndex()
  const idx = index.ids.indexOf(id)
  if (idx > -1) {
    index.ids.splice(idx, 1)
    index.updatedAt = Date.now()
    return saveRecordIndex(index)
  }
  return true
}

export async function getRecordById(id: string): Promise<ConvertRecord | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    return (await kv.get(`${KV_KEYS.RECORD_PREFIX}${id}`, 'json')) as ConvertRecord | null
  } catch (error) {
    logger.error('[RecordRepo] 获取记录失败:', error)
    return null
  }
}

async function saveRecord(record: ConvertRecord): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    await kv.put(`${KV_KEYS.RECORD_PREFIX}${record.id}`, JSON.stringify(record), {
      expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
    })
    return true
  } catch (error) {
    logger.error('[RecordRepo] 保存记录失败:', error)
    return false
  }
}

export async function getDailyStats(date: string): Promise<DailyStats | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    return (await kv.get(`${KV_KEYS.DAILY_PREFIX}${date}`, 'json')) as DailyStats | null
  } catch (error) {
    logger.error('[RecordRepo] 获取每日统计失败:', error)
    return null
  }
}

async function incrementDailyHits(recordId: string): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    const today = new Date().toISOString().slice(0, 10)
    const key = `${KV_KEYS.DAILY_PREFIX}${today}`
    const todayUrlsKey = `${KV_KEYS.DAILY_PREFIX}${today}:urls`

    const [current, urlsData] = await Promise.all([
      getDailyStats(today),
      kv.get(todayUrlsKey, 'json') as Promise<{ ids: string[] } | null>,
    ])

    const visitedUrls = new Set(urlsData?.ids || [])
    const isNewToday = !visitedUrls.has(recordId)

    const stats: DailyStats = {
      date: today,
      totalHits: (current?.totalHits || 0) + 1,
      uniqueUrls: (current?.uniqueUrls || 0) + (isNewToday ? 1 : 0),
    }

    if (isNewToday) {
      visitedUrls.add(recordId)
      await kv.put(todayUrlsKey, JSON.stringify({ ids: Array.from(visitedUrls) }), {
        expirationTtl: KV_TTL_SECONDS.TWO_DAYS,
      })
    }

    await kv.put(key, JSON.stringify(stats), {
      expirationTtl: KV_TTL_SECONDS.THIRTY_DAYS,
    })

    return true
  } catch (error) {
    logger.error('[RecordRepo] 更新每日统计失败:', error)
    return false
  }
}

export async function logConversion(params: {
  originalUrl: string
  clientType: string
  nodeCount: number
  clientIp: string
  subscriptionName?: string
}): Promise<ConvertRecord | null> {
  if (!(await isKvAvailable())) return null

  const { originalUrl, clientType, nodeCount, clientIp, subscriptionName } = params

  try {
    const id = await generateRecordId(originalUrl)
    const now = Date.now()
    const existing = await getRecordById(id)

    if (existing) {
      const updated: ConvertRecord = {
        ...existing,
        name: subscriptionName || existing.name,
        clientType,
        updatedAt: now,
        lastAccess: now,
        hits: existing.hits + 1,
        nodeCount,
        lastIp: clientIp,
      }
      await saveRecord(updated)
      await incrementDailyHits(id)
      return updated
    }

    const record: ConvertRecord = {
      id,
      originalUrl,
      name: subscriptionName || extractNameFromUrl(originalUrl),
      clientType,
      createdAt: now,
      updatedAt: now,
      lastAccess: now,
      hits: 1,
      nodeCount,
      lastIp: clientIp,
    }

    await saveRecord(record)
    await addRecordToIndex(id)
    await incrementDailyHits(id)
    return record
  } catch (error) {
    logger.error('[RecordRepo] 记录转换失败:', error)
    return null
  }
}

export async function isUrlEnabled(url: string): Promise<boolean> {
  if (!(await isKvAvailable())) return true

  try {
    const id = await generateRecordId(url)
    const record = await getRecordById(id)
    return record ? !record.deleted : true
  } catch {
    return true
  }
}

export async function getActiveRecords(): Promise<ConvertRecord[]> {
  const index = await getRecordIndex()
  const records = (await Promise.all(index.ids.map(getRecordById)))
    .filter((record): record is ConvertRecord => record !== null && !record.deleted)

  return records.sort((a, b) => b.lastAccess - a.lastAccess)
}

export async function listAllRecordsForAdmin(): Promise<ConvertRecord[]> {
  if (!(await isKvAvailable())) return []

  const keys = await listKeysByPrefix(KV_KEYS.RECORD_PREFIX)
  const ids = keys
    .filter((name) => name.startsWith(KV_KEYS.RECORD_PREFIX))
    .map((name) => name.slice(KV_KEYS.RECORD_PREFIX.length))

  const records = (await Promise.all(ids.map(getRecordById))).filter(
    (record): record is ConvertRecord => record !== null,
  )

  return records.sort((a, b) => b.lastAccess - a.lastAccess)
}

export async function updateRecord(
  id: string,
  updates: Partial<ConvertRecord>,
): Promise<ConvertRecord | null> {
  const existing = await getRecordById(id)
  if (!existing) return null

  const updated: ConvertRecord = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }

  await saveRecord(updated)
  return updated
}

export async function setRecordEnabled(id: string, enabled: boolean): Promise<ConvertRecord | null> {
  const record = await updateRecord(id, { deleted: !enabled })
  if (record && enabled) {
    await addRecordToIndex(id)
  }
  return record
}

export async function softDeleteRecord(id: string): Promise<boolean> {
  const record = await updateRecord(id, { deleted: true })
  if (!record) return false
  await removeRecordFromIndex(id)
  return true
}

export async function deleteRecordPermanently(id: string): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  const existing = await getRecordById(id)
  if (!existing) return false

  try {
    await kv.delete(`${KV_KEYS.RECORD_PREFIX}${id}`)
    await removeRecordFromIndex(id)
    return true
  } catch (error) {
    logger.error('[RecordRepo] 永久删除记录失败:', error)
    return false
  }
}

export async function createRecordManually(
  url: string,
  name?: string,
): Promise<ConvertRecord | null> {
  if (!(await isKvAvailable())) return null

  try {
    const id = await generateRecordId(url)
    const now = Date.now()
    const existing = await getRecordById(id)

    if (existing) {
      const updated = await updateRecord(id, name ? { name } : {})
      return updated || existing
    }

    const record: ConvertRecord = {
      id,
      originalUrl: url,
      name: name || extractNameFromUrl(url),
      clientType: 'admin',
      createdAt: now,
      updatedAt: now,
      lastAccess: now,
      hits: 0,
      nodeCount: 0,
      lastIp: '',
    }

    await saveRecord(record)
    await addRecordToIndex(id)
    return record
  } catch (error) {
    logger.error('[RecordRepo] 手动登记订阅失败:', error)
    return null
  }
}

export async function getStats(): Promise<StatsData> {
  const records = await getActiveRecords()
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  let totalHits = 0
  let activeRecords = 0

  for (const record of records) {
    totalHits += record.hits
    if (record.lastAccess > sevenDaysAgo) {
      activeRecords++
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const dailyStats = await getDailyStats(today)

  return {
    totalRecords: records.length,
    totalHits,
    todayHits: dailyStats?.totalHits || 0,
    activeRecords,
  }
}

export async function getRecentDailyStats(days: number): Promise<DailyStats[]> {
  const now = new Date()
  const dates: string[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().slice(0, 10))
  }

  const results = await Promise.all(dates.map(getDailyStats))
  return results
    .filter((item): item is DailyStats => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}
