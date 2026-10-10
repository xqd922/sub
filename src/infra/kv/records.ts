import * as client from '@/infra/kv/operations'
import { ConvertRecord, StatsData, DailyStats } from '@/infra/kv/types'
import { extractNameFromUrl } from '@/infra/utils'
import { logger } from '@/infra/logger'

export async function generateRecordId(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.slice(0, 12)
}

export async function logConversion(params: {
  originalUrl: string
  clientType: string
  nodeCount: number
  clientIp: string
  subscriptionName?: string
}): Promise<ConvertRecord | null> {
  const { originalUrl, clientType, nodeCount, clientIp, subscriptionName } = params

  if (!(await client.isAvailable())) {
    return null
  }

  try {
    const id = await generateRecordId(originalUrl)
    const now = Date.now()

    const existing = await client.getRecord(id)

    if (existing) {

      const updated: ConvertRecord = {
        ...existing,
        name: subscriptionName || existing.name,
        clientType,
        updatedAt: now,
        lastAccess: now,
        hits: existing.hits + 1,
        nodeCount,
        lastIp: clientIp
      }
      await client.saveRecord(updated)

      await client.incrementDailyHits(id)

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
      lastIp: clientIp
    }

    await client.saveRecord(record)
    await client.addToIndex(id)

    await client.incrementDailyHits(id)

    return record
  } catch (error) {
    logger.error('[RecordService] 记录转换失败:', error)
    return null
  }
}

export async function isUrlEnabled(url: string): Promise<boolean> {
  if (!(await client.isAvailable())) {
    return true 
  }

  try {
    const id = await generateRecordId(url)
    const record = await client.getRecord(id)

    if (!record) return true
    return !record.deleted
  } catch {
    return true
  }
}

export async function getRecords(): Promise<ConvertRecord[]> {
  const allRecords = await client.getAllRecords()

  return allRecords.filter(record => !record.deleted)
}

export async function getRecord(id: string): Promise<ConvertRecord | null> {
  return client.getRecord(id)
}

export async function updateRecord(id: string, updates: Partial<ConvertRecord>): Promise<ConvertRecord | null> {
  const record = await client.getRecord(id)
  if (!record) return null

  const updated: ConvertRecord = {
    ...record,
    ...updates,
    updatedAt: Date.now()
  }

  await client.saveRecord(updated)
  return updated
}

export async function deleteRecord(id: string): Promise<boolean> {
  const record = await client.getRecord(id)
  if (!record) return false

  const updated: ConvertRecord = {
    ...record,
    deleted: true,
    updatedAt: Date.now()
  }

  await client.saveRecord(updated)

  await client.removeFromIndex(id)
  return true
}

export async function getStats(): Promise<StatsData> {
  const records = await getRecords()
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  let totalHits = 0
  let activeRecords = 0

  for (const record of records) {
    totalHits += record.hits

    if (record.lastAccess > sevenDaysAgo) {
      activeRecords++
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const dailyStats = await client.getDailyStats(today)
  const todayHits = dailyStats?.totalHits || 0

  return {
    totalRecords: records.length,
    totalHits,
    todayHits,
    activeRecords
  }
}

export async function listAllRecordsForAdmin(): Promise<ConvertRecord[]> {
  if (!(await client.isAvailable())) {
    return []
  }

  return client.fetchAllRecordsIncludingDeleted()
}

export async function setRecordEnabled(id: string, enabled: boolean): Promise<ConvertRecord | null> {
  const record = await updateRecord(id, { deleted: !enabled })

  if (record && enabled) {
    await client.addToIndex(id)
  }

  return record
}

export async function deleteRecordPermanently(id: string): Promise<boolean> {
  const record = await client.getRecord(id)
  if (!record) return false

  await client.deleteRecordById(id)
  await client.removeFromIndex(id)
  return true
}

export async function createRecordManually(url: string, name?: string): Promise<ConvertRecord | null> {
  if (!(await client.isAvailable())) {
    return null
  }

  try {
    const id = await generateRecordId(url)
    const now = Date.now()

    const existing = await client.getRecord(id)
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
      lastIp: ''
    }

    await client.saveRecord(record)
    await client.addToIndex(id)

    return record
  } catch (error) {
    logger.error('[RecordService] 手动登记订阅失败:', error)
    return null
  }
}

export async function getRecentDailyStats(days: number): Promise<DailyStats[]> {
  const results: DailyStats[] = []
  const now = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)

    const stats = await client.getDailyStats(dateStr)
    if (stats) {
      results.push(stats)
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}
