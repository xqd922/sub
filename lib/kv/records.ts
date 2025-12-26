import { KVClient } from './client'
import { ConvertRecord, StatsData } from './types'

/**
 * 生成记录 ID（基于 URL 的 hash）
 */
async function generateRecordId(url: string): Promise<string> {
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
 * 记录服务 - 管理转换记录
 */
export class RecordService {

  /**
   * 记录一次转换（核心方法）
   */
  static async logConversion(params: {
    originalUrl: string
    clientType: string
    nodeCount: number
    clientIp: string
    subscriptionName?: string
  }): Promise<ConvertRecord | null> {
    const { originalUrl, clientType, nodeCount, clientIp, subscriptionName } = params

    // 检查 KV 是否可用
    if (!(await KVClient.isAvailable())) {
      return null
    }

    try {
      const id = await generateRecordId(originalUrl)
      const now = Date.now()

      // 检查是否已存在记录
      const existing = await KVClient.getRecord(id)

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
        await KVClient.saveRecord(updated)
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

      await KVClient.saveRecord(record)
      await KVClient.addToIndex(id)

      return record
    } catch (error) {
      console.error('[RecordService] 记录转换失败:', error)
      return null
    }
  }

  /**
   * 检查 URL 是否可用（未被删除）
   */
  static async isUrlEnabled(url: string): Promise<boolean> {
    if (!(await KVClient.isAvailable())) {
      return true // KV 不可用时默认允许
    }

    try {
      const id = await generateRecordId(url)
      const record = await KVClient.getRecord(id)
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
  static async getAllRecords(): Promise<ConvertRecord[]> {
    const allRecords = await KVClient.getAllRecords()
    // 过滤掉已删除的记录
    return allRecords.filter(record => !record.deleted)
  }

  /**
   * 获取单条记录
   */
  static async getRecord(id: string): Promise<ConvertRecord | null> {
    return KVClient.getRecord(id)
  }

  /**
   * 更新记录
   */
  static async updateRecord(id: string, updates: Partial<ConvertRecord>): Promise<ConvertRecord | null> {
    const record = await KVClient.getRecord(id)
    if (!record) return null

    const updated: ConvertRecord = {
      ...record,
      ...updates,
      updatedAt: Date.now()
    }

    await KVClient.saveRecord(updated)
    return updated
  }

  /**
   * 删除记录（软删除，标记为已删除，链接将失效）
   */
  static async deleteRecord(id: string): Promise<boolean> {
    const record = await KVClient.getRecord(id)
    if (!record) return false

    // 软删除：标记为已删除
    const updated: ConvertRecord = {
      ...record,
      deleted: true,
      updatedAt: Date.now()
    }

    await KVClient.saveRecord(updated)
    // 从索引中移除（不再显示在列表中）
    await KVClient.removeFromIndex(id)
    return true
  }

  /**
   * 获取统计数据
   */
  static async getStats(): Promise<StatsData> {
    const records = await this.getAllRecords()
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const todayStart = new Date().setHours(0, 0, 0, 0)

    let totalHits = 0
    let todayHits = 0
    let activeRecords = 0

    for (const record of records) {
      totalHits += record.hits

      if (record.lastAccess > sevenDaysAgo) {
        activeRecords++
      }

      // 简化：用最后访问判断今日访问（实际应该单独记录）
      if (record.lastAccess > todayStart) {
        todayHits += 1
      }
    }

    return {
      totalRecords: records.length,
      totalHits,
      todayHits,
      activeRecords
    }
  }
}
