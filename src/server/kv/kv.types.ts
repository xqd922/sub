export interface KvListResult {
  keys: Array<{ name: string }>
  list_complete?: boolean
  cursor?: string
}

export interface KvStoreAdapter {
  get(key: string, type?: 'json' | 'text'): Promise<unknown>
  getMany?<T = unknown>(keys: string[], type?: 'json' | 'text'): Promise<Map<string, T | null>>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KvListResult>
}

export interface RecordIndex {
  ids: string[]
  updatedAt: number
}

export const KV_KEYS = {
  RECORD_PREFIX: 'record:',
  RECORD_INDEX: 'index:records',
  DAILY_PREFIX: 'stats:daily:',
  SHORT_PREFIX: 'short:',
  SHORT_URL_PREFIX: 'short:url:',
  SHORT_INDEX: 'index:shortlinks',
  CLIENT_RULES: 'config:client_rules',
  ROUTING_RULES: 'config:routing_rules',
  LOGIN_LOG: 'admin:login-log',
  PING: 'admin:ping',
} as const

export const KV_TTL_SECONDS = {
  ONE_YEAR: 86400 * 365,
  THIRTY_DAYS: 86400 * 30,
  TWO_DAYS: 86400 * 2,
} as const
