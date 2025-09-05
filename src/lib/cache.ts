interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CachedResponse {
  content: string
  headers: Record<string, string>
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 分钟默认缓存时间

  set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // 获取缓存统计信息
  getStats(): { size: number; keys: string[] } {
    this.cleanup() // 先清理过期缓存
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// 创建全局缓存实例
export const subscriptionCache = new MemoryCache()

// 定期清理过期缓存（每10分钟）
if (typeof global !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    subscriptionCache.cleanup()
  }, 10 * 60 * 1000)
  
  // 防止在测试环境中累积定时器
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

export type { CachedResponse }