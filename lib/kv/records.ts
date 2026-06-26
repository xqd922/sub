import * as client from './client'
import { ConvertRecord, StatsData } from './types'

/**
 * 生成记录 ID（基于 URL 的 hash）
 */
export async function generateRecordId(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.slice(0, 12)
}

/**
 * 从 URL 提取订阅名称
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // 尝试从参数中获取名称
    const name = urlObj.searchParams.get('name') ||
                 urlObj.searchParams.get('remarks') ||
                 urlObj.searchParams.get('tag')

    if (name) return decodeURIComponent(name)

    // 使用 hostname 作为名称
    return urlObj.hostname
  } catch {
    return '未知订阅'
  }
}

/**
 * 记录一次转换（核心方法）
 */
export async function logConversion(params: {
  originalUrl: string
  clientType: string
  nodeCount: number
  clientIp: string
  subscriptionName?: string
}): Promise<ConvertRecord | null> {
  const { originalUrl, clientType, nodeCount, clientIp, subscriptionName } = params

  // 检查 KV 是否可用
  if (!(await client.isAvailable())) {
    return null
  }

  try {
    const id = await generateRecordId(originalUrl)
    const now = Date.now()

    // 检查是否已存在记录
    const existing = await client.getRecord(id)

    if (existing) {
      // 更新已有记录（如果有新的订阅名称，也更新名称）
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

      // 记录每日统计
      await client.incrementDailyHits(id)

      return updated
    }

    // 创建新记录
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

    // 记录每日统计
    await client.incrementDailyHits(id)

    return record
  } catch (error) {
    console.error('[RecordService] 记录转换失败:', error)
    return null
  }
}

/**
 * 检查 URL 是否可用（未被删除）
 */
export async function isUrlEnabled(url: string): Promise<boolean> {
  if (!(await client.isAvailable())) {
    return true // KV 不可用时默认允许
  }

  try {
    const id = await generateRecordId(url)
    const record = await client.getRecord(id)
    // 如果记录不存在，允许访问（新链接）
    // 如果记录存在且 deleted=true，拒绝访问
    if (!record) return true
    return !record.deleted
  } catch {
    return true
  }
}

/**
 * 获取所有记录（排除已删除的）
 */
export async function getRecords(): Promise<ConvertRecord[]> {
  const allRecords = await client.getAllRecords()
  // 过滤掉已删除的记录
  return allRecords.filter(record => !record.deleted)
}

/**
 * 获取单条记录
 */
export async function getRecord(id: string): Promise<ConvertRecord | null> {
  return client.getRecord(id)
}

/**
 * 更新记录
 */
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

/**
 * 删除记录（软删除，标记为已删除，链接将失效）
 */
export async function deleteRecord(id: string): Promise<boolean> {
  const record = await client.getRecord(id)
  if (!record) return false

  // 软删除：标记为已删除
  const updated: ConvertRecord = {
    ...record,
    deleted: true,
    updatedAt: Date.now()
  }

  await client.saveRecord(updated)
  // 从索引中移除（不再显示在列表中）
  await client.removeFromIndex(id)
  return true
}

/**
 * 获取统计数据
 */
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

  // 获取真实的今日访问次数
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
