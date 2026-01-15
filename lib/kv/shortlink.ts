import { ShortLink, KV_PREFIX } from './types'
import { getLocalKV, isLocalDev } from './local'

/**
 * Cloudflare 环境接口
 */
interface CloudflareEnv {
  LINKS_KV?: KVNamespace
}

/**
 * 获取 KV 绑定
 */
async function getKV(): Promise<KVNamespace | null> {
  // 本地开发环境，返回 Mock KV
  if (isLocalDev()) {
    return getLocalKV()
  }

  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as CloudflareEnv
    return env.LINKS_KV || null
  } catch {
    // 回退到本地 Mock
    return getLocalKV()
  }
}

/**
 * 生成短链接 ID (6位字符)
 */
async function generateShortId(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url + Date.now())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // 使用 base62 风格的字符
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16) % chars.length
    result += chars[idx]
  }
  return result
}

/**
 * 从 URL 提取名称
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // 检查是否是转换后的链接
    const originalUrl = urlObj.searchParams.get('url')
    if (originalUrl) {
      const decodedUrl = decodeURIComponent(originalUrl)
      const innerUrl = new URL(decodedUrl)
      return innerUrl.searchParams.get('name') ||
             innerUrl.searchParams.get('remarks') ||
             innerUrl.hostname
    }
    return urlObj.hostname
  } catch {
    return '短链接'
  }
}

// 短链接索引 key
const SHORT_INDEX_KEY = 'index:shortlinks'

/**
 * 短链接服务
 */
export class ShortLinkService {

  /**
   * 检查 KV 是否可用
   */
  static async isAvailable(): Promise<boolean> {
    const kv = await getKV()
    return kv !== null
  }

  /**
   * 创建短链接
   */
  static async create(targetUrl: string): Promise<ShortLink | null> {
    const kv = await getKV()
    if (!kv) return null

    try {
      const id = await generateShortId(targetUrl)
      const now = Date.now()

      // 检查是否已存在（基于目标 URL 的 hash）
      const urlHash = await this.getUrlHash(targetUrl)
      const existingId = await kv.get(`${KV_PREFIX.SHORT}url:${urlHash}`)

      if (existingId) {
        // 返回已存在的短链接
        const existing = await this.get(existingId)
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

      // 保存短链接
      await kv.put(
        `${KV_PREFIX.SHORT}${id}`,
        JSON.stringify(shortLink),
        { expirationTtl: 86400 * 365 } // 1年过期
      )

      // 保存 URL -> ID 的映射（用于去重）
      await kv.put(
        `${KV_PREFIX.SHORT}url:${urlHash}`,
        id,
        { expirationTtl: 86400 * 365 }
      )

      // 添加到索引
      await this.addToIndex(id)

      return shortLink
    } catch (error) {
      console.error('[ShortLink] 创建失败:', error)
      return null
    }
  }

  /**
   * 获取短链接
   */
  static async get(id: string): Promise<ShortLink | null> {
    const kv = await getKV()
    if (!kv) return null

    try {
      const data = await kv.get(`${KV_PREFIX.SHORT}${id}`, 'json')
      return data as ShortLink | null
    } catch (error) {
      console.error('[ShortLink] 获取失败:', error)
      return null
    }
  }

  /**
   * 获取所有短链接
   */
  static async getAll(): Promise<ShortLink[]> {
    const kv = await getKV()
    if (!kv) return []

    try {
      const indexData = await kv.get(SHORT_INDEX_KEY, 'json') as { ids: string[] } | null
      const ids = indexData?.ids || []

      const shortLinks: ShortLink[] = []
      for (const id of ids) {
        const link = await this.get(id)
        if (link) shortLinks.push(link)
      }

      // 按创建时间倒序
      return shortLinks.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('[ShortLink] 获取全部失败:', error)
      return []
    }
  }

  /**
   * 删除短链接
   */
  static async delete(id: string): Promise<boolean> {
    const kv = await getKV()
    if (!kv) return false

    try {
      // 获取短链接信息以删除 URL 映射
      const shortLink = await this.get(id)
      if (shortLink) {
        const urlHash = await this.getUrlHash(shortLink.targetUrl)
        await kv.delete(`${KV_PREFIX.SHORT}url:${urlHash}`)
      }

      // 删除短链接
      await kv.delete(`${KV_PREFIX.SHORT}${id}`)

      // 从索引移除
      await this.removeFromIndex(id)

      return true
    } catch (error) {
      console.error('[ShortLink] 删除失败:', error)
      return false
    }
  }

  /**
   * 记录访问并返回目标 URL
   */
  static async resolve(id: string): Promise<string | null> {
    const kv = await getKV()
    if (!kv) return null

    try {
      const shortLink = await this.get(id)
      if (!shortLink) return null

      // 更新访问统计
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
      console.error('[ShortLink] 解析失败:', error)
      return null
    }
  }

  /**
   * 添加到索引
   */
  private static async addToIndex(id: string): Promise<void> {
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
      console.error('[ShortLink] 添加索引失败:', error)
    }
  }

  /**
   * 从索引移除
   */
  private static async removeFromIndex(id: string): Promise<void> {
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
      console.error('[ShortLink] 移除索引失败:', error)
    }
  }

  /**
   * 生成 URL 的 hash（用于去重）
   */
  private static async getUrlHash(url: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  }
}
