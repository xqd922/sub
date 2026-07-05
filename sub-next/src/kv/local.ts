export interface KVStoreAdapter {
  get(key: string, type?: 'json' | 'text'): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>
}

class RemoteKVStore implements KVStoreAdapter {
  private accountId: string
  private namespaceId: string
  private apiToken: string
  private baseUrl: string

  constructor() {
    this.accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''
    this.namespaceId = process.env.CF_KV_NAMESPACE_ID || process.env.CLOUDFLARE_KV_NAMESPACE_ID || ''
    this.apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
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
      console.error('[RemoteKV] GET 失败:', key, error)
      return null
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      const params = new URLSearchParams()
      if (options?.expirationTtl) {
        params.set('expiration_ttl', options.expirationTtl.toString())
      }
      const url = `/values/${encodeURIComponent(key)}${params.toString() ? '?' + params.toString() : ''}`
      await this.request(url, {
        method: 'PUT',
        body: value,
        headers: { 'Content-Type': 'text/plain' },
      })
    } catch (error) {
      console.error('[RemoteKV] PUT 失败:', key, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.request(`/values/${encodeURIComponent(key)}`, { method: 'DELETE' })
    } catch (error) {
      console.error('[RemoteKV] DELETE 失败:', key, error)
    }
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    try {
      const params = new URLSearchParams()
      if (options?.prefix) params.set('prefix', options.prefix)
      const res = await this.request(`/keys?${params.toString()}`)
      if (!res.ok) return { keys: [] }
      const data = await res.json() as { result?: Array<{ name: string }> }
      return { keys: data.result || [] }
    } catch (error) {
      console.error('[RemoteKV] LIST 失败:', error)
      return { keys: [] }
    }
  }
}

class LocalKVStore implements KVStoreAdapter {
  private records = new Map<string, string>()

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

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.records.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key)
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.records.keys())
    const prefix = options?.prefix
    const filtered = prefix
      ? keys.filter(k => k.startsWith(prefix))
      : keys
    return { keys: filtered.map(name => ({ name })) }
  }
}

let kvStore: KVStoreAdapter | null = null

function hasRemoteKVConfig(): boolean {
  const hasAccountId = !!(process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID)
  const hasNamespaceId = !!(process.env.CF_KV_NAMESPACE_ID || process.env.CLOUDFLARE_KV_NAMESPACE_ID)
  const hasToken = !!(process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)

  return hasAccountId && hasNamespaceId && hasToken
}

export function getLocalKV(): KVStoreAdapter {
  if (!kvStore) {
    if (hasRemoteKVConfig()) {
      kvStore = new RemoteKVStore()
      console.log('[RemoteKV] 已连接到 Cloudflare KV')
    } else {
      kvStore = new LocalKVStore()
      console.log('[LocalKV] 已初始化本地 KV Mock 存储')
    }
  }
  return kvStore
}