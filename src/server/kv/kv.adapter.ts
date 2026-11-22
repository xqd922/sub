import { getRemoteKvConfig } from '@/server/env.config'
import type { KvListResult, KvStoreAdapter } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'

const KV_BULK_GET_LIMIT = 100

function parseBulkValue<T>(raw: unknown, type?: 'json' | 'text'): T | null {
  if (raw === null || raw === undefined) return null
  // Cloudflare /bulk/get with metadata wraps as { value, metadata }; unwrap defensively
  const candidate =
    typeof raw === 'object' &&
    raw !== null &&
    'value' in raw &&
    Object.keys(raw as Record<string, unknown>).every((k) => k === 'value' || k === 'metadata')
      ? (raw as { value: unknown }).value
      : raw

  if (candidate === null || candidate === undefined) return null
  if (type === 'json') {
    if (typeof candidate === 'string') {
      try {
        return JSON.parse(candidate) as T
      } catch {
        return null
      }
    }
    return candidate as T
  }
  return (typeof candidate === 'string' ? candidate : JSON.stringify(candidate)) as T
}

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

  async getMany<T = unknown>(
    keys: string[],
    type: 'json' | 'text' = 'json',
  ): Promise<Map<string, T | null>> {
    const output = new Map<string, T | null>()
    if (keys.length === 0) return output

    const chunks: string[][] = []
    for (let i = 0; i < keys.length; i += KV_BULK_GET_LIMIT) {
      chunks.push(keys.slice(i, i + KV_BULK_GET_LIMIT))
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const res = await this.request('/bulk/get', {
            method: 'POST',
            body: JSON.stringify({ keys: chunk, type }),
          })
          if (res.ok) {
            const payload = (await res.json()) as {
              success?: boolean
              result?: { values?: Record<string, unknown> } | Record<string, unknown>
            }
            const rawMap =
              payload?.result &&
              typeof payload.result === 'object' &&
              'values' in payload.result &&
              payload.result.values &&
              typeof payload.result.values === 'object'
                ? (payload.result.values as Record<string, unknown>)
                : (payload?.result as Record<string, unknown> | undefined)

            if (rawMap && typeof rawMap === 'object') {
              for (const key of chunk) {
                output.set(key, parseBulkValue<T>(rawMap[key], type))
              }
              return
            }
          }
        } catch (error) {
          logger.warn('[RemoteKV] BULK GET 回退到并发单键读取:', error)
        }

        const fallback = await Promise.all(chunk.map((key) => this.get<T>(key, type)))
        chunk.forEach((key, idx) => {
          output.set(key, fallback[idx] ?? null)
        })
      }),
    )

    return output
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

  async list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KvListResult> {
    try {
      const params = new URLSearchParams()
      if (options?.prefix) params.set('prefix', options.prefix)
      if (options?.cursor) params.set('cursor', options.cursor)
      if (options?.limit) params.set('limit', String(options.limit))

      const res = await this.request(`/keys?${params.toString()}`)
      if (!res.ok) return { keys: [], list_complete: true }

      const data = (await res.json()) as {
        result?: Array<{ name: string }>
        result_info?: { cursor?: string }
      }
      const nextCursor = data.result_info?.cursor || undefined
      return {
        keys: data.result || [],
        list_complete: !nextCursor,
        cursor: nextCursor,
      }
    } catch (error) {
      logger.error('[RemoteKV] LIST 失败:', error)
      return { keys: [], list_complete: true }
    }
  }
}

interface MemoryEntry {
  value: string
  expiresAt?: number
}

export class MemoryKvStore implements KvStoreAdapter {
  private readonly records = new Map<string, MemoryEntry>()

  private getValidEntry(key: string): MemoryEntry | null {
    const entry = this.records.get(key)
    if (!entry) return null
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.records.delete(key)
      return null
    }
    return entry
  }

  async get<T = unknown>(key: string, type?: 'json' | 'text'): Promise<T | null> {
    const entry = this.getValidEntry(key)
    if (!entry) return null
    if (type === 'json') {
      try {
        return JSON.parse(entry.value) as T
      } catch {
        return null
      }
    }
    return entry.value as T
  }

  async getMany<T = unknown>(
    keys: string[],
    type: 'json' | 'text' = 'json',
  ): Promise<Map<string, T | null>> {
    const output = new Map<string, T | null>()
    for (const key of keys) {
      output.set(key, await this.get<T>(key, type))
    }
    return output
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiresAt =
      typeof options?.expirationTtl === 'number'
        ? Date.now() + options.expirationTtl * 1000
        : undefined
    this.records.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key)
  }

  async list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KvListResult> {
    const prefix = options?.prefix
    const names: string[] = []
    for (const key of Array.from(this.records.keys())) {
      if (!this.getValidEntry(key)) continue
      if (!prefix || key.startsWith(prefix)) {
        names.push(key)
      }
    }
    names.sort()

    const offset = options?.cursor ? Math.max(0, Number.parseInt(options.cursor, 10) || 0) : 0
    const limit = options?.limit && options.limit > 0 ? options.limit : names.length
    const slice = names.slice(offset, offset + limit)
    const nextOffset = offset + slice.length
    const hasMore = nextOffset < names.length

    return {
      keys: slice.map((name) => ({ name })),
      list_complete: !hasMore,
      cursor: hasMore ? String(nextOffset) : undefined,
    }
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
