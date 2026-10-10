import { getKV } from '@/infra/kv/store'
import { logger } from '@/infra/logger'

const LOGIN_LOG_KEY = 'admin:login-log'
const LOGIN_LOG_LIMIT = 20

export interface LoginAttempt {
  time: number
  ip: string
  ok: boolean
  userAgent?: string
}

export async function appendLoginAttempt(entry: LoginAttempt): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    const existing = await kv.get(LOGIN_LOG_KEY, 'json') as LoginAttempt[] | null
    const log = Array.isArray(existing) ? existing : []

    log.unshift(entry)
    await kv.put(LOGIN_LOG_KEY, JSON.stringify(log.slice(0, LOGIN_LOG_LIMIT)))
  } catch (error) {
    logger.error('[Auth] 记录登录日志失败:', error)
  }
}

export async function getLoginLog(): Promise<LoginAttempt[]> {
  const kv = await getKV()
  if (!kv) return []

  try {
    const data = await kv.get(LOGIN_LOG_KEY, 'json') as LoginAttempt[] | null
    return Array.isArray(data) ? data : []
  } catch (error) {
    logger.error('[Auth] 读取登录日志失败:', error)
    return []
  }
}
