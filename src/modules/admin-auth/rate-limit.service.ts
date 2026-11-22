export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_MS = 10 * 60 * 1000

const MAX_TRACKED_IPS = 1000
const failedLogins = new Map<string, number[]>()

function pruneTimestamps(timestamps: number[], nowMs: number): number[] {
  return timestamps.filter((ts) => nowMs - ts < LOGIN_WINDOW_MS)
}

export function checkLoginRateLimit(
  ip: string,
  nowMs: number = Date.now(),
): { allowed: boolean; retryAfterSec: number } {
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
