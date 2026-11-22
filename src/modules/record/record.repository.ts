import { getKvStore, getManyJson, isKvAvailable, listKeysByPrefix } from '@/server/kv/kv.client'
import { KV_KEYS, KV_TTL_SECONDS, type RecordIndex } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { ConvertRecord, DailyStats, HourlyStats, StatsData } from '@/shared/admin.types'
import { extractNameFromUrl } from '@/shared/url.utils'

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
    const nowIso = new Date().toISOString()
    const today = nowIso.slice(0, 10)
    const currentHour = nowIso.slice(0, 13)
    const dailyKey = `${KV_KEYS.DAILY_PREFIX}${today}`
    const dailyUrlsKey = `${KV_KEYS.DAILY_PREFIX}${today}:urls`
    const hourlyKey = `${KV_KEYS.HOURLY_PREFIX}${currentHour}`
    const hourlyUrlsKey = `${KV_KEYS.HOURLY_PREFIX}${currentHour}:urls`

    const [currentDaily, dailyUrlsData, currentHourly, hourlyUrlsData] = await Promise.all([
      getDailyStats(today),
      kv.get(dailyUrlsKey, 'json') as Promise<{ ids: string[] } | null>,
      kv.get(hourlyKey, 'json') as Promise<HourlyStats | null>,
      kv.get(hourlyUrlsKey, 'json') as Promise<{ ids: string[] } | null>,
    ])

    const visitedDailyUrls = new Set(dailyUrlsData?.ids || [])
    const isNewToday = !visitedDailyUrls.has(recordId)
    const dailyStats: DailyStats = {
      date: today,
      totalHits: (currentDaily?.totalHits || 0) + 1,
      uniqueUrls: (currentDaily?.uniqueUrls || 0) + (isNewToday ? 1 : 0),
    }

    const visitedHourlyUrls = new Set(hourlyUrlsData?.ids || [])
    const isNewThisHour = !visitedHourlyUrls.has(recordId)
    const hourlyStats: HourlyStats = {
      hour: currentHour,
      totalHits: (currentHourly?.totalHits || 0) + 1,
      uniqueUrls: (currentHourly?.uniqueUrls || 0) + (isNewThisHour ? 1 : 0),
    }

    const writes: Promise<void>[] = [
      kv.put(dailyKey, JSON.stringify(dailyStats), {
        expirationTtl: KV_TTL_SECONDS.THIRTY_DAYS,
      }),
      kv.put(hourlyKey, JSON.stringify(hourlyStats), {
        expirationTtl: KV_TTL_SECONDS.TWO_DAYS,
      }),
    ]

    if (isNewToday) {
      visitedDailyUrls.add(recordId)
      writes.push(
        kv.put(dailyUrlsKey, JSON.stringify({ ids: Array.from(visitedDailyUrls) }), {
          expirationTtl: KV_TTL_SECONDS.TWO_DAYS,
        }),
      )
    }

    if (isNewThisHour) {
      visitedHourlyUrls.add(recordId)
      writes.push(
        kv.put(hourlyUrlsKey, JSON.stringify({ ids: Array.from(visitedHourlyUrls) }), {
          expirationTtl: KV_TTL_SECONDS.TWO_DAYS,
        }),
      )
    }

    await Promise.all(writes)
    return true
  } catch (error) {
    logger.error('[RecordRepo] 更新统计失败:', error)
    return false
  }
}

export async function logConversion(params: {
  originalUrl: string
  clientType: string
  nodeCount: number
  clientIp: string
  userAgent?: string
  subscriptionName?: string
}): Promise<ConvertRecord | null> {
  if (!(await isKvAvailable())) return null

  const { originalUrl, clientType, nodeCount, clientIp, userAgent, subscriptionName } = params
  const cleanUa = userAgent?.trim().slice(0, 300) || undefined

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
        ...(cleanUa ? { lastUserAgent: cleanUa } : {}),
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
      ...(cleanUa ? { lastUserAgent: cleanUa } : {}),
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
  if (index.ids.length === 0) return []

  const keys = index.ids.map((id) => `${KV_KEYS.RECORD_PREFIX}${id}`)
  const values = await getManyJson<ConvertRecord>(keys)
  const records: ConvertRecord[] = []
  for (const record of values.values()) {
    if (record && !record.deleted) records.push(record)
  }

  return records.sort((a, b) => b.lastAccess - a.lastAccess)
}

export async function listAllRecordsForAdmin(): Promise<ConvertRecord[]> {
  if (!(await isKvAvailable())) return []

  const keys = (await listKeysByPrefix(KV_KEYS.RECORD_PREFIX)).filter((name) =>
    name.startsWith(KV_KEYS.RECORD_PREFIX),
  )
  if (keys.length === 0) return []

  const values = await getManyJson<ConvertRecord>(keys)
  const records: ConvertRecord[] = []
  for (const record of values.values()) {
    if (record) records.push(record)
  }

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

export function computeStatsFromData(
  allRecords: ConvertRecord[],
  todayHits: number,
  totalShortLinks: number,
): StatsData {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let totalRecords = 0
  let disabledRecords = 0
  let totalHits = 0
  let activeRecords = 0

  for (const record of allRecords) {
    if (record.deleted) {
      disabledRecords++
      continue
    }
    totalRecords++
    totalHits += record.hits
    if (record.lastAccess > sevenDaysAgo) {
      activeRecords++
    }
  }

  return {
    totalRecords,
    disabledRecords,
    totalShortLinks,
    totalHits,
    todayHits,
    activeRecords,
  }
}

export async function getStats(): Promise<StatsData> {
  const today = new Date().toISOString().slice(0, 10)
  const [allRecords, dailyStats, shortKeys] = await Promise.all([
    listAllRecordsForAdmin(),
    getDailyStats(today),
    listKeysByPrefix(KV_KEYS.SHORT_PREFIX),
  ])

  const totalShortLinks = shortKeys.filter(
    (name) => name.startsWith(KV_KEYS.SHORT_PREFIX) && !name.startsWith(KV_KEYS.SHORT_URL_PREFIX),
  ).length

  return computeStatsFromData(allRecords, dailyStats?.totalHits || 0, totalShortLinks)
}

export async function getRecentDailyStats(days: number): Promise<DailyStats[]> {
  if (days <= 0) return []

  const now = new Date()
  const targetKeys = new Set<string>()
  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    targetKeys.add(`${KV_KEYS.DAILY_PREFIX}${date.toISOString().slice(0, 10)}`)
  }

  // 先 list 一次筛选真实存在的日期键，避免对空日期发起几十次 KV 缓存穿透回源
  const existingKeys = (await listKeysByPrefix(KV_KEYS.DAILY_PREFIX)).filter((key) =>
    targetKeys.has(key),
  )
  if (existingKeys.length === 0) return []

  const values = await getManyJson<DailyStats>(existingKeys)
  const results: DailyStats[] = []
  for (const item of values.values()) {
    if (item && typeof item.date === 'string') {
      results.push(item)
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getRecentHourlyStats(hours = 24): Promise<HourlyStats[]> {
  if (hours <= 0) return []

  const now = new Date()
  now.setUTCMinutes(0, 0, 0)
  const targetKeys = new Set<string>()
  for (let i = 0; i < hours; i++) {
    const bucket = new Date(now.getTime() - i * 3_600_000)
    targetKeys.add(`${KV_KEYS.HOURLY_PREFIX}${bucket.toISOString().slice(0, 13)}`)
  }

  const existingKeys = (await listKeysByPrefix(KV_KEYS.HOURLY_PREFIX)).filter((key) =>
    targetKeys.has(key),
  )
  if (existingKeys.length === 0) return []

  const values = await getManyJson<HourlyStats>(existingKeys)
  const results: HourlyStats[] = []
  for (const item of values.values()) {
    if (item && typeof item.hour === 'string') {
      results.push(item)
    }
  }

  return results.sort((a, b) => a.hour.localeCompare(b.hour))
}
