import { getRemoteKvConfig } from '@/server/env.config'
import { logger } from '@/server/logger'
import type { KvStoreAdapter } from '@/server/kv/kv.types'

class RemoteKvStore implements KvStoreAdapter {
  private readonly baseUrl: string
  private readonly apiToken: string

  constructor(config: { accountId: string; namespaceId: string; apiToken: string }) {
    this.apiToken = config.apiToken
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}`
  }

  private request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  async get<T = unknown>(key: string, type?: 'json' | 'text'): Promise<T | null> {
    try {
      const res = await this.request(`/values/${encodeURIComponent(key)}`)
      if (!res.ok) return null
      const text = await res.text()
      if (!text) return null
      if (type === 'json') {
        try {
          return JSON.parse(text) as T
        } catch {
          return null
        }
      }
      return text as T
    } catch (error) {
      logger.error('[RemoteKV] GET 失败:', key, error)
      return null
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      const params = new URLSearchParams()
      if (options?.expirationTtl) {
        params.set('expiration_ttl', String(options.expirationTtl))
      }
      const query = params.toString()
      const url = `/values/${encodeURIComponent(key)}${query ? `?${query}` : ''}`
      await this.request(url, {
        method: 'PUT',
        body: value,
        headers: { 'Content-Type': 'text/plain' },
      })
    } catch (error) {
      logger.error('[RemoteKV] PUT 失败:', key, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.request(`/values/${encodeURIComponent(key)}`, { method: 'DELETE' })
    } catch (error) {
      logger.error('[RemoteKV] DELETE 失败:', key, error)
    }
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    try {
      const params = new URLSearchParams()
      if (options?.prefix) params.set('prefix', options.prefix)
      const res = await this.request(`/keys?${params.toString()}`)
      if (!res.ok) return { keys: [] }
      const data = (await res.json()) as { result?: Array<{ name: string }> }
      return { keys: data.result || [] }
    } catch (error) {
      logger.error('[RemoteKV] LIST 失败:', error)
      return { keys: [] }
    }
  }
}

class MemoryKvStore implements KvStoreAdapter {
  private readonly records = new Map<string, string>()

  async get<T = unknown>(key: string, type?: 'json' | 'text'): Promise<T | null> {
    const value = this.records.get(key)
    if (!value) return null
    if (type === 'json') {
      try {
        return JSON.parse(value) as T
      } catch {
        return null
      }
    }
    return value as T
  }

  async put(key: string, value: string): Promise<void> {
    this.records.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key)
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const prefix = options?.prefix
    const keys = Array.from(this.records.keys())
    const filtered = prefix ? keys.filter((key) => key.startsWith(prefix)) : keys
    return { keys: filtered.map((name) => ({ name })) }
  }
}

// next dev 下每个边缘路由沙箱持有独立模块实例，挂到 globalThis 以跨路由共享本地存储
const globalKvHolder = globalThis as unknown as { __subKVStore?: KvStoreAdapter }

export function getFallbackKvStore(): KvStoreAdapter {
  if (!globalKvHolder.__subKVStore) {
    const remoteConfig = getRemoteKvConfig()
    if (remoteConfig) {
      globalKvHolder.__subKVStore = new RemoteKvStore(remoteConfig)
      logger.info('[RemoteKV] 已连接到 Cloudflare KV')
    } else {
      globalKvHolder.__subKVStore = new MemoryKvStore()
      logger.info('[LocalKV] 已初始化本地 KV Mock 存储')
    }
  }
  return globalKvHolder.__subKVStore
}

export function resetFallbackKvStore(): void {
  delete globalKvHolder.__subKVStore
}
