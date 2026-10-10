import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { getSessionFromRequest } from '@/auth/session'

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 10 * 60 * 1000

const MAX_TRACKED_IPS = 1000

const failedLogins = new Map<string, number[]>()

function pruneTimestamps(timestamps: number[], nowMs: number): number[] {
  return timestamps.filter(ts => nowMs - ts < LOGIN_WINDOW_MS)
}

export function checkLoginRateLimit(ip: string, nowMs: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const timestamps = pruneTimestamps(failedLogins.get(ip) ?? [], nowMs)
  if (timestamps.length >= LOGIN_MAX_ATTEMPTS) {
    const oldest = Math.min(...timestamps)
    const retryAfterSec = Math.max(1, Math.ceil((oldest + LOGIN_WINDOW_MS - nowMs) / 1000))
    return { allowed: false, retryAfterSec }
  }
  return { allowed: true, retryAfterSec: 0 }
}

export function recordFailedLogin(ip: string, nowMs: number = Date.now()): void {
  const timestamps = pruneTimestamps(failedLogins.get(ip) ?? [], nowMs)

  if (!failedLogins.has(ip) && failedLogins.size >= MAX_TRACKED_IPS) {
    const oldestKey = failedLogins.keys().next().value
    if (oldestKey !== undefined) {
      failedLogins.delete(oldestKey)
    }
  }

  timestamps.push(nowMs)
  failedLogins.set(ip, timestamps)
}

export function clearLoginAttempts(ip: string): void {
  failedLogins.delete(ip)
}

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

export async function requireAdmin(request: Request): Promise<AppError | null> {
  const session = await getSessionFromRequest(request)
  if (session) return null

  return new AppError(
    ErrorCode.AUTH_FAILED,
    '未登录或会话已过期',
    401,
    ErrorSeverity.MEDIUM
  )
}
