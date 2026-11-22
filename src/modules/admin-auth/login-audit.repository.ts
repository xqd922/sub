import { getKvStore } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type { LoginAttempt } from '@/shared/admin.types'

const LOGIN_LOG_LIMIT = 20

export async function appendLoginAttempt(entry: LoginAttempt): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  try {
    const existing = (await kv.get(KV_KEYS.LOGIN_LOG, 'json')) as LoginAttempt[] | null
    const log = Array.isArray(existing) ? existing : []
    log.unshift(entry)
    await kv.put(KV_KEYS.LOGIN_LOG, JSON.stringify(log.slice(0, LOGIN_LOG_LIMIT)))
  } catch (error) {
    logger.error('[Auth] 记录登录日志失败:', error)
  }
}

export async function getLoginAuditLog(): Promise<LoginAttempt[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const data = (await kv.get(KV_KEYS.LOGIN_LOG, 'json')) as LoginAttempt[] | null
    return Array.isArray(data) ? data : []
  } catch (error) {
    logger.error('[Auth] 读取登录日志失败:', error)
    return []
  }
}
