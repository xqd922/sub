/**
 * 本地开发 Mock KV Store
 * 仅在 process.env.NODE_ENV === 'development' 时生效
 */

import { ConvertRecord, ShortLink } from './types'

class LocalKVStore {
  private records = new Map<string, string>()

  async get<T = any>(key: string): Promise<T | null> {
    const value = this.records.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.records.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key)
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.records.keys())
    const filtered = options?.prefix
      ? keys.filter(k => k.startsWith(options.prefix))
      : keys
    return { keys: filtered.map(name => ({ name })) }
  }
}

// 全局单例
let localStore: LocalKVStore | null = null

export function getLocalKV(): any {
  if (!localStore) {
    localStore = new LocalKVStore()
    console.log('[LocalKV] 已初始化本地 KV Mock 存储')
  }
  return localStore
}

export function isLocalDev(): boolean {
  return process.env.NODE_ENV === 'development'
}
