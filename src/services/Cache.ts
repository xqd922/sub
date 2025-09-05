import { logger } from '@/lib/logger'

/**
 * 缓存服务 - 管理内存缓存
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class CacheService {
  private static cache = new Map<string, CacheEntry<unknown>>()

  /**
   * 生成缓存键
   */
  static generateKey(url: string, clientType: 'clash' | 'singbox' | 'browser'): string {
    return `${url}:${clientType}`
  }

  /**
   * 设置缓存
   */
  static set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    }
    this.cache.set(key, entry)
    logger.debug(`缓存已设置: ${key}, TTL: ${ttlMinutes}分钟`)
  }

  /**
   * 获取缓存
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      logger.debug(`缓存已过期并删除: ${key}`)
      return null
    }

    logger.debug(`缓存命中: ${key}`)
    return entry.data as T
  }

  /**
   * 清理过期缓存
   */
  static cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`清理了 ${cleanedCount} 个过期缓存项`)
    }
  }

  /**
   * 获取缓存统计
   */
  static getStats(): { total: number; active: number } {
    const now = Date.now()
    let active = 0

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= entry.ttl) {
        active++
      }
    }

    return {
      total: this.cache.size,
      active
    }
  }

  /**
   * 清空所有缓存
   */
  static clear(): void {
    const count = this.cache.size
    this.cache.clear()
    logger.debug(`清空了所有缓存 (${count} 项)`)
  }
}