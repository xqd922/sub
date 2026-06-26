import { ShortLink, KV_PREFIX } from '@/kv/types'
import { getKV } from '@/kv/env'
import { extractNameFromUrl } from '@/utils'
import { logger } from '@/logger'

const SHORT_INDEX_KEY = 'index:shortlinks'

async function generateShortId(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url + Date.now())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16) % chars.length
    result += chars[idx]
  }
  return result
}

async function getUrlHash(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

async function addToIndex(id: string): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    const indexData = await kv.get(SHORT_INDEX_KEY, 'json') as { ids: string[] } | null
    const ids = indexData?.ids || []

    if (!ids.includes(id)) {
      ids.push(id)
      await kv.put(SHORT_INDEX_KEY, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLink] 添加索引失败:', error)
  }
}

async function removeFromIndex(id: string): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    const indexData = await kv.get(SHORT_INDEX_KEY, 'json') as { ids: string[] } | null
    const ids = indexData?.ids || []

    const idx = ids.indexOf(id)
    if (idx > -1) {
      ids.splice(idx, 1)
      await kv.put(SHORT_INDEX_KEY, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLink] 移除索引失败:', error)
  }
}

export async function isAvailable(): Promise<boolean> {
  const kv = await getKV()
  return kv !== null
}

export async function createShortLink(targetUrl: string): Promise<ShortLink | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const id = await generateShortId(targetUrl)
    const now = Date.now()

    const urlHash = await getUrlHash(targetUrl)
    const existingId = await kv.get(`${KV_PREFIX.SHORT}url:${urlHash}`) as string | null

    if (existingId) {

      const existing = await getShortLink(existingId)
      if (existing) return existing
    }

    const shortLink: ShortLink = {
      id,
      targetUrl,
      name: extractNameFromUrl(targetUrl),
      createdAt: now,
      hits: 0,
      lastAccess: now
    }

    await kv.put(
      `${KV_PREFIX.SHORT}${id}`,
      JSON.stringify(shortLink),
      { expirationTtl: 86400 * 365 } 
    )

    await kv.put(
      `${KV_PREFIX.SHORT}url:${urlHash}`,
      id,
      { expirationTtl: 86400 * 365 }
    )

    await addToIndex(id)

    return shortLink
  } catch (error) {
    logger.error('[ShortLink] 创建失败:', error)
    return null
  }
}

async function getShortLink(id: string): Promise<ShortLink | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const data = await kv.get(`${KV_PREFIX.SHORT}${id}`, 'json')
    return data as ShortLink | null
  } catch (error) {
    logger.error('[ShortLink] 获取失败:', error)
    return null
  }
}

export async function getAllShortLinks(): Promise<ShortLink[]> {
  const kv = await getKV()
  if (!kv) return []

  try {
    const indexData = await kv.get(SHORT_INDEX_KEY, 'json') as { ids: string[] } | null
    const ids = indexData?.ids || []

    const linkPromises = ids.map(id => getShortLink(id))
    const linkResults = await Promise.all(linkPromises)

    const shortLinks = linkResults.filter((link): link is ShortLink => link !== null)

    return shortLinks.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    logger.error('[ShortLink] 获取全部失败:', error)
    return []
  }
}

export async function updateShortLink(id: string, updates: Partial<Pick<ShortLink, 'name'>>): Promise<ShortLink | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const shortLink = await getShortLink(id)
    if (!shortLink) return null

    const updated: ShortLink = {
      ...shortLink,
      ...updates
    }

    await kv.put(
      `${KV_PREFIX.SHORT}${id}`,
      JSON.stringify(updated),
      { expirationTtl: 86400 * 365 }
    )

    return updated
  } catch (error) {
    logger.error('[ShortLink] 更新失败:', error)
    return null
  }
}

export async function deleteShortLink(id: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {

    const shortLink = await getShortLink(id)
    if (shortLink) {
      const urlHash = await getUrlHash(shortLink.targetUrl)
      await kv.delete(`${KV_PREFIX.SHORT}url:${urlHash}`)
    }

    await kv.delete(`${KV_PREFIX.SHORT}${id}`)

    await removeFromIndex(id)

    return true
  } catch (error) {
    logger.error('[ShortLink] 删除失败:', error)
    return false
  }
}

export async function resolveShortLink(id: string): Promise<string | null> {
  const kv = await getKV()
  if (!kv) return null

  try {
    const shortLink = await getShortLink(id)
    if (!shortLink) return null

    const updated: ShortLink = {
      ...shortLink,
      hits: shortLink.hits + 1,
      lastAccess: Date.now()
    }

    await kv.put(
      `${KV_PREFIX.SHORT}${id}`,
      JSON.stringify(updated),
      { expirationTtl: 86400 * 365 }
    )

    return shortLink.targetUrl
  } catch (error) {
    logger.error('[ShortLink] 解析失败:', error)
    return null
  }
}