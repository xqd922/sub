import { isDevelopment } from '@/server/config/env.config'
import { getFallbackKvStore } from '@/server/kv/kv.adapter'
import { KV_KEYS, type KvStoreAdapter } from '@/server/kv/kv.types'
import { logger } from '@/server/logger/logger'
import type { KvPingResult } from '@/shared/types/admin.types'

interface CloudflareBindings {
  LINKS_KV?: KVNamespace
}

export async function getKvStore(): Promise<KvStoreAdapter | null> {
  if (isDevelopment()) {
    return getFallbackKvStore()
  }

  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const env = getRequestContext().env as CloudflareBindings
    return env.LINKS_KV || null
  } catch {
    return getFallbackKvStore()
  }
}

export async function isKvAvailable(): Promise<boolean> {
  return (await getKvStore()) !== null
}

export async function listKeysByPrefix(prefix: string): Promise<string[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const result = await kv.list({ prefix })
    return result.keys.map((item) => item.name)
  } catch (error) {
    logger.error('[KV] 列举键失败:', error)
    return []
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
