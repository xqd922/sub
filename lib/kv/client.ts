import { ConvertRecord, RecordIndex, DailyStats, KV_PREFIX } from './types'
import { getLocalKV, isLocalDev } from './local'

/**
 * Cloudflare 环境接口
 */
interface CloudflareEnv {
  LINKS_KV?: KVNamespace
}

/**
 * 获取 KV 绑定
 * 在 Cloudflare Pages 中通过 getRequestContext 获取
 */
async function getKV(): Promise<KVNamespace | null> {
  // 本地开发环境，返回 Mock KV
  if (isLocalDev()) {
    return getLocalKV()
  }

  try {
    // 动态导入，避免在非 CF 环境报错
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as CloudflareEnv
    return env.LINKS_KV || null
  } catch {
    // 如果无法获取 CF 上下文，回退到本地 Mock
    return getLocalKV()
  }
}

/**
 * KV 客户端 - 封装所有 KV 操作
 */
export class KVClient {

  /**
   * 检查 KV 是否可用
   */
  static async isAvailable(): Promise<boolean> {
    const kv = await getKV()
    return kv !== null
  }

  /**
   * 获取单条记录
   */
  static async getRecord(id: string): Promise<ConvertRecord | null> {
    const kv = await getKV()
    if (!kv) return null

    try {
      const data = await kv.get(`${KV_PREFIX.RECORD}${id}`, 'json')
      return data as ConvertRecord | null
    } catch (error) {
      console.error('[KV] 获取记录失败:', error)
      return null
    }
  }

  /**
   * 保存记录
   */
  static async saveRecord(record: ConvertRecord): Promise<boolean> {
    const kv = await getKV()
    if (!kv) return false

    try {
      await kv.put(
        `${KV_PREFIX.RECORD}${record.id}`,
        JSON.stringify(record),
        { expirationTtl: 86400 * 365 } // 1年过期
      )
      return true
    } catch (error) {
      console.error('[KV] 保存记录失败:', error)
      return false
    }
  }

  /**
   * 删除记录
   */
  static async deleteRecord(id: string): Promise<boolean> {
    const kv = await getKV()
    if (!kv) return false

    try {
      await kv.delete(`${KV_PREFIX.RECORD}${id}`)
      return true
    } catch (error) {
      console.error('[KV] 删除记录失败:', error)
      return false
    }
  }

  /**
   * 获取索引
   */
  static async getIndex(): Promise<RecordIndex> {
    const kv = await getKV()
    if (!kv) return { ids: [], updatedAt: Date.now() }

    try {
      const data = await kv.get(KV_PREFIX.INDEX, 'json')
      return (data as RecordIndex) || { ids: [], updatedAt: Date.now() }
    } catch (error) {
      console.error('[KV] 获取索引失败:', error)
      return { ids: [], updatedAt: Date.now() }
    }
  }

  /**
   * 更新索引
   */
  static async updateIndex(index: RecordIndex): Promise<boolean> {
    const kv = await getKV()
    if (!kv) return false

    try {
      await kv.put(KV_PREFIX.INDEX, JSON.stringify(index))
      return true
    } catch (error) {
      console.error('[KV] 更新索引失败:', error)
      return false
    }
  }

  /**
   * 添加 ID 到索引
   */
  static async addToIndex(id: string): Promise<boolean> {
    const index = await this.getIndex()
    if (!index.ids.includes(id)) {
      index.ids.push(id)
      index.updatedAt = Date.now()
      return this.updateIndex(index)
    }
    return true
  }

  /**
   * 从索引移除 ID
   */
  static async removeFromIndex(id: string): Promise<boolean> {
    const index = await this.getIndex()
    const idx = index.ids.indexOf(id)
    if (idx > -1) {
      index.ids.splice(idx, 1)
      index.updatedAt = Date.now()
      return this.updateIndex(index)
    }
    return true
  }

  /**
   * 获取所有记录
   */
  static async getAllRecords(): Promise<ConvertRecord[]> {
    const index = await this.getIndex()
    const records: ConvertRecord[] = []

    for (const id of index.ids) {
      const record = await this.getRecord(id)
      if (record) {
        records.push(record)
      }
    }

    // 按最后访问时间倒序排列
    return records.sort((a, b) => b.lastAccess - a.lastAccess)
  }

  /**
   * 获取每日统计
   */
  static async getDailyStats(date: string): Promise<DailyStats | null> {
    const kv = await getKV()
    if (!kv) return null

    try {
      const data = await kv.get(`${KV_PREFIX.DAILY}${date}`, 'json')
      return data as DailyStats | null
    } catch (error) {
      console.error('[KV] 获取每日统计失败:', error)
      return null
    }
  }

  /**
   * 更新每日统计（增加访问次数）
   */
  static async incrementDailyHits(recordId: string): Promise<boolean> {
    const kv = await getKV()
    if (!kv) return false

    try {
      const today = new Date().toISOString().slice(0, 10)
      const key = `${KV_PREFIX.DAILY}${today}`

      // 获取当前统计
      const current = await this.getDailyStats(today)
      const todayUrlsKey = `${KV_PREFIX.DAILY}${today}:urls`
      const urlsData = await kv.get(todayUrlsKey, 'json') as { ids: string[] } | null
      const visitedUrls = new Set(urlsData?.ids || [])

      // 更新统计
      const stats: DailyStats = {
        date: today,
        totalHits: (current?.totalHits || 0) + 1,
        uniqueUrls: visitedUrls.has(recordId) ? (current?.uniqueUrls || 0) : (current?.uniqueUrls || 0) + 1
      }

      // 记录访问过的 URL
      if (!visitedUrls.has(recordId)) {
        visitedUrls.add(recordId)
        await kv.put(todayUrlsKey, JSON.stringify({ ids: Array.from(visitedUrls) }), {
          expirationTtl: 86400 * 2 // 2天过期
        })
      }

      await kv.put(key, JSON.stringify(stats), {
        expirationTtl: 86400 * 30 // 30天过期
      })

      return true
    } catch (error) {
      console.error('[KV] 更新每日统计失败:', error)
      return false
    }
  }
}
