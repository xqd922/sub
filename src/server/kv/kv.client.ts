import { isDevelopment } from '@/server/env.config'
import { getFallbackKvStore } from '@/server/kv/kv.adapter'
import { KV_KEYS, type KvStoreAdapter } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { KvPingResult } from '@/shared/admin.types'

interface CloudflareBindings {
  LINKS_KV?: KVNamespace
}

const MAX_LIST_PAGES = 20
const KV_BULK_GET_LIMIT = 100

let nextOnPagesModulePromise: Promise<typeof import('@cloudflare/next-on-pages')> | null = null

function loadNextOnPages() {
  if (!nextOnPagesModulePromise) {
    nextOnPagesModulePromise = import('@cloudflare/next-on-pages')
  }
  return nextOnPagesModulePromise
}

export async function getKvStore(): Promise<KvStoreAdapter | null> {
  if (isDevelopment()) {
    return getFallbackKvStore()
  }

  try {
    const { getRequestContext } = await loadNextOnPages()
    const env = getRequestContext().env as CloudflareBindings
    return (env.LINKS_KV as unknown as KvStoreAdapter | undefined) || null
  } catch {
    return getFallbackKvStore()
  }
}

export async function isKvAvailable(): Promise<boolean> {
  return (await getKvStore()) !== null
}

/**
 * Batch-reads up to 100 JSON keys per Cloudflare KV RPC (or REST /bulk/get),
 * falling back transparently to parallel single-key gets if bulk read isn't supported.
 */
export async function getManyJson<T>(keys: string[]): Promise<Map<string, T | null>> {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)))
  const output = new Map<string, T | null>()
  if (uniqueKeys.length === 0) return output

  const kv = await getKvStore()
  if (!kv) return output

  if (typeof kv.getMany === 'function') {
    return kv.getMany<T>(uniqueKeys, 'json')
  }

  const chunks: string[][] = []
  for (let i = 0; i < uniqueKeys.length; i += KV_BULK_GET_LIMIT) {
    chunks.push(uniqueKeys.slice(i, i + KV_BULK_GET_LIMIT))
  }

  const nativeBulkGet = kv.get as unknown as (
    batch: string[],
    type: 'json',
  ) => Promise<Map<string, T | null>>

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const result = await nativeBulkGet.call(kv, chunk, 'json')
        if (result instanceof Map) {
          for (const key of chunk) {
            output.set(key, (result.get(key) as T | null) ?? null)
          }
          return
        }
      } catch {
        // Fallback below when runtime KV mock doesn't support array-key bulk get
      }

      const fallback = await Promise.all(
        chunk.map(async (key) => {
          try {
            return (await kv.get(key, 'json')) as T | null
          } catch {
            return null
          }
        }),
      )
      chunk.forEach((key, idx) => {
        output.set(key, fallback[idx] ?? null)
      })
    }),
  )

  return output
}

export async function listKeysByPrefix(prefix: string): Promise<string[]> {
  const kv = await getKvStore()
  if (!kv) return []

  const allKeys: string[] = []
  let cursor: string | undefined

  try {
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const result = await kv.list({ prefix, ...(cursor ? { cursor } : {}) })
      for (const item of result.keys) {
        allKeys.push(item.name)
      }

      if (result.list_complete !== false || !result.cursor) {
        break
      }
      cursor = result.cursor
    }
    return allKeys
  } catch (error) {
    logger.error('[KV] 列举键失败:', error)
    return allKeys
  }
}

export async function pingKv(): Promise<KvPingResult> {
  const kv = await getKvStore()
  if (!kv) return { ok: false, latencyMs: 0 }

  const startedAt = Date.now()
  try {
    const token = `ping-${startedAt}`
    await kv.put(KV_KEYS.PING, token)
    const echoed = await kv.get(KV_KEYS.PING)
    await kv.delete(KV_KEYS.PING)
    return { ok: echoed === token, latencyMs: Date.now() - startedAt }
  } catch (error) {
    logger.error('[KV] 连通性测试失败:', error)
    return { ok: false, latencyMs: Date.now() - startedAt }
  }
}
