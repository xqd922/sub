import { ConvertRecord, RecordIndex, DailyStats, KV_PREFIX } from '@/kv/types'
import { getKV } from '@/kv/env'

/**
 * 检查 KV 是否可用
 */
export async function isAvailable(): Promise<boolean> {
  const kv = await getKV()
  return kv !== null
}

/**
 * 获取单条记录
 */
export async function getRecord(id: string): Promise<ConvertRecord | null> {
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
export async function saveRecord(record: ConvertRecord): Promise<boolean> {
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
export async function deleteRecordById(id: string): Promise<boolean> {
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
export async function getIndex(): Promise<RecordIndex> {
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
export async function updateIndex(index: RecordIndex): Promise<boolean> {
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
export async function addToIndex(id: string): Promise<boolean> {
  const index = await getIndex()
  if (!index.ids.includes(id)) {
    index.ids.push(id)
    index.updatedAt = Date.now()
    return updateIndex(index)
  }
  return true
}

/**
 * 从索引移除 ID
 */
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

/**
 * 获取所有记录（并行优化）
 */
export async function getAllRecords(): Promise<ConvertRecord[]> {
  const index = await getIndex()

  // 并行获取所有记录
  const recordPromises = index.ids.map(id => getRecord(id))
  const recordResults = await Promise.all(recordPromises)

  // 过滤掉 null 值
  const records = recordResults.filter((r): r is ConvertRecord => r !== null)

  // 按最后访问时间倒序排列
  return records.sort((a, b) => b.lastAccess - a.lastAccess)
}

/**
 * 获取每日统计
 */
export async function getDailyStats(date: string): Promise<DailyStats | null> {
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
export async function incrementDailyHits(recordId: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    const today = new Date().toISOString().slice(0, 10)
    const key = `${KV_PREFIX.DAILY}${today}`

    // 获取当前统计
    const current = await getDailyStats(today)
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
