/**
 * 本地开发 KV Store
 * 支持两种模式：
 * 1. Mock 模式：内存存储（默认）
 * 2. Remote 模式：连接 Cloudflare KV API（通过环境变量配置）
 */

/**
 * 远程 KV 客户端 - 通过 Cloudflare API 访问
 */
class RemoteKVStore {
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

  async get(key: string, type?: 'json' | 'text'): Promise<any> {
    try {
      const res = await this.request(`/values/${encodeURIComponent(key)}`)
      if (!res.ok) return null
      const text = await res.text()
      if (!text) return null
      if (type === 'json') {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      }
      return text
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

/**
 * 本地 Mock KV Store（内存存储）
 */
class LocalKVStore {
  private records = new Map<string, string>()

  async get(key: string, type?: 'json' | 'text'): Promise<any> {
    const value = this.records.get(key)
    if (!value) return null
    if (type === 'json') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return value
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

// 全局单例
let kvStore: LocalKVStore | RemoteKVStore | null = null

/**
 * 检查是否配置了远程 KV
 */
function hasRemoteKVConfig(): boolean {
  const hasAccountId = !!(process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID)
  const hasNamespaceId = !!(process.env.CF_KV_NAMESPACE_ID || process.env.CLOUDFLARE_KV_NAMESPACE_ID)
  const hasToken = !!(process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN)

  return hasAccountId && hasNamespaceId && hasToken
}

export function getLocalKV(): any {
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

export function isLocalDev(): boolean {
  return process.env.NODE_ENV === 'development'
}
