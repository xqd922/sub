import { getKvStore } from '@/server/kv/kv.client'
import { KV_KEYS, KV_TTL_SECONDS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { ShortLink } from '@/shared/admin.types'
import { extractNameFromUrl } from '@/shared/url.utils'

const SHORT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

async function sha256Hex(value: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function generateShortId(url: string): Promise<string> {
  const hashHex = await sha256Hex(url)
  let id = ''
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16) % SHORT_ID_ALPHABET.length
    id += SHORT_ID_ALPHABET[idx]
  }
  return id
}

async function getUrlHash(url: string): Promise<string> {
  return (await sha256Hex(url)).slice(0, 16)
}

async function addShortIdToIndex(id: string): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    if (!ids.includes(id)) {
      ids.push(id)
      await kv.put(KV_KEYS.SHORT_INDEX, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLinkRepo] 添加索引失败:', error)
  }
}

async function removeShortIdFromIndex(id: string): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    const idx = ids.indexOf(id)
    if (idx > -1) {
      ids.splice(idx, 1)
      await kv.put(KV_KEYS.SHORT_INDEX, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLinkRepo] 移除索引失败:', error)
  }
}

export async function getShortLink(id: string): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    return (await kv.get(`${KV_KEYS.SHORT_PREFIX}${id}`, 'json')) as ShortLink | null
  } catch (error) {
    logger.error('[ShortLinkRepo] 获取失败:', error)
    return null
  }
}

export async function createShortLink(
  targetUrl: string,
  customName?: string,
): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    const urlHash = await getUrlHash(targetUrl)
    const existingId = (await kv.get(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`)) as string | null
    if (existingId) {
      const existing = await getShortLink(existingId)
      if (existing) {
        if (customName && customName.trim() && customName.trim() !== existing.name) {
          return (await updateShortLink(existing.id, { name: customName.trim() })) || existing
        }
        return existing
      }
    }

    const id = await generateShortId(targetUrl)
    const now = Date.now()
    const shortLink: ShortLink = {
      id,
      targetUrl,
      name: customName?.trim() || extractNameFromUrl(targetUrl),
      createdAt: now,
      hits: 0,
      lastAccess: now,
    }

    await Promise.all([
      kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(shortLink), {
        expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
      }),
      kv.put(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`, id, {
        expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
      }),
    ])
    await addShortIdToIndex(id)

    return shortLink
  } catch (error) {
    logger.error('[ShortLinkRepo] 创建失败:', error)
    return null
  }
}

export async function getAllShortLinks(): Promise<ShortLink[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    const links = (await Promise.all(ids.map(getShortLink))).filter(
      (link): link is ShortLink => link !== null,
    )
    return links.sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    logger.error('[ShortLinkRepo] 获取全部失败:', error)
    return []
  }
}

export async function updateShortLink(
  id: string,
  updates: Partial<Pick<ShortLink, 'name' | 'targetUrl'>>,
): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    const existing = await getShortLink(id)
    if (!existing) return null

    const nextTargetUrl = updates.targetUrl?.trim() || existing.targetUrl
    const targetChanged = nextTargetUrl !== existing.targetUrl

    const updated: ShortLink = {
      ...existing,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      targetUrl: nextTargetUrl,
    }

    const tasks: Array<Promise<void>> = [
      kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(updated), {
        expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
      }),
    ]

    if (targetChanged) {
      const [oldHash, newHash] = await Promise.all([
        getUrlHash(existing.targetUrl),
        getUrlHash(nextTargetUrl),
      ])
      tasks.push(kv.delete(`${KV_KEYS.SHORT_URL_PREFIX}${oldHash}`))
      tasks.push(
        kv.put(`${KV_KEYS.SHORT_URL_PREFIX}${newHash}`, id, {
          expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
        }),
      )
    }

    await Promise.all(tasks)
    return updated
  } catch (error) {
    logger.error('[ShortLinkRepo] 更新失败:', error)
    return null
  }
}

export async function deleteShortLink(id: string): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    const existing = await getShortLink(id)
    if (!existing) return false

    const urlHash = await getUrlHash(existing.targetUrl)
    await Promise.all([
      kv.delete(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`),
      kv.delete(`${KV_KEYS.SHORT_PREFIX}${id}`),
    ])
    await removeShortIdFromIndex(id)
    return true
  } catch (error) {
    logger.error('[ShortLinkRepo] 删除失败:', error)
    return false
  }
}

export async function resolveShortLink(id: string): Promise<string | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    const shortLink = await getShortLink(id)
    if (!shortLink) return null

    const updated: ShortLink = {
      ...shortLink,
      hits: shortLink.hits + 1,
      lastAccess: Date.now(),
    }

    await kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(updated), {
      expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
    })
    return shortLink.targetUrl
  } catch (error) {
    logger.error('[ShortLinkRepo] 解析失败:', error)
    return null
  }
}
