/**
 * Session 管理模块
 * 使用 KV 存储 session token，支持过期时间
 */

// Session 过期时间（24小时）
const SESSION_TTL = 24 * 60 * 60

// 登录尝试限制
const LOGIN_ATTEMPT_LIMIT = 5          // 最大尝试次数
const LOGIN_LOCKOUT_TIME = 15 * 60     // 锁定时间（15分钟）

// 前缀
const SESSION_PREFIX = 'session:'
const LOGIN_ATTEMPT_PREFIX = 'login_attempt:'

interface Session {
  token: string
  username: string
  createdAt: number
  expiresAt: number
  ip?: string
  userAgent?: string
}

/**
 * 获取 KV 绑定
 */
async function getKV(): Promise<KVNamespace | null> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as { LINKS_KV?: KVNamespace }
    return env.LINKS_KV || null
  } catch {
    return null
  }
}

/**
 * 生成安全的 session token
 */
export async function generateToken(): Promise<string> {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 创建新 session
 */
export async function createSession(
  username: string,
  ip?: string,
  userAgent?: string
): Promise<string | null> {
  const kv = await getKV()
  if (!kv) {
    // KV 不可用时，返回一个临时 token（仅用于开发环境）
    return await generateToken()
  }

  const token = await generateToken()
  const now = Date.now()

  const session: Session = {
    token,
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL * 1000,
    ip,
    userAgent
  }

  try {
    // 存储 session，设置 TTL 自动过期
    await kv.put(
      `${SESSION_PREFIX}${token}`,
      JSON.stringify(session),
      { expirationTtl: SESSION_TTL }
    )
    return token
  } catch {
    return null
  }
}

/**
 * 验证 session token
 */
export async function validateSession(token: string): Promise<Session | null> {
  if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
    return null
  }

  const kv = await getKV()
  if (!kv) {
    // KV 不可用时（开发环境），简单验证格式
    // 生产环境必须配置 KV
    if (process.env.NODE_ENV === 'development') {
      return {
        token,
        username: 'admin',
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL * 1000
      }
    }
    return null
  }

  try {
    const data = await kv.get(`${SESSION_PREFIX}${token}`, 'json')
    if (!data) {
      return null
    }

    const session = data as Session

    // 检查是否过期
    if (session.expiresAt < Date.now()) {
      // 删除过期 session
      await kv.delete(`${SESSION_PREFIX}${token}`)
      return null
    }

    return session
  } catch {
    return null
  }
}

/**
 * 删除 session（登出）
 */
export async function deleteSession(token: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    await kv.delete(`${SESSION_PREFIX}${token}`)
    return true
  } catch {
    return false
  }
}

/**
 * 刷新 session 过期时间
 */
export async function refreshSession(token: string): Promise<boolean> {
  const kv = await getKV()
  if (!kv) return false

  try {
    const session = await validateSession(token)
    if (!session) return false

    // 更新过期时间
    session.expiresAt = Date.now() + SESSION_TTL * 1000

    await kv.put(
      `${SESSION_PREFIX}${token}`,
      JSON.stringify(session),
      { expirationTtl: SESSION_TTL }
    )
    return true
  } catch {
    return false
  }
}

// ==================== 登录尝试限制 ====================

interface LoginAttempt {
  count: number
  lastAttempt: number
  lockedUntil?: number
}

/**
 * 检查 IP 是否被锁定
 */
export async function isLoginLocked(ip: string): Promise<{ locked: boolean; remainingTime?: number }> {
  const kv = await getKV()
  if (!kv) {
    // KV 不可用时不限制（开发环境）
    return { locked: false }
  }

  try {
    const data = await kv.get(`${LOGIN_ATTEMPT_PREFIX}${ip}`, 'json')
    if (!data) {
      return { locked: false }
    }

    const attempt = data as LoginAttempt
    if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
      const remainingTime = Math.ceil((attempt.lockedUntil - Date.now()) / 1000)
      return { locked: true, remainingTime }
    }

    return { locked: false }
  } catch {
    return { locked: false }
  }
}

/**
 * 记录登录失败尝试
 */
export async function recordFailedLogin(ip: string): Promise<{
  attemptsLeft: number
  locked: boolean
  lockoutTime?: number
}> {
  const kv = await getKV()
  if (!kv) {
    return { attemptsLeft: LOGIN_ATTEMPT_LIMIT, locked: false }
  }

  try {
    const data = await kv.get(`${LOGIN_ATTEMPT_PREFIX}${ip}`, 'json')
    let attempt: LoginAttempt = data as LoginAttempt || { count: 0, lastAttempt: 0 }

    // 如果上次尝试已经超过锁定时间，重置计数
    if (attempt.lockedUntil && attempt.lockedUntil < Date.now()) {
      attempt = { count: 0, lastAttempt: 0 }
    }

    attempt.count += 1
    attempt.lastAttempt = Date.now()

    // 检查是否需要锁定
    if (attempt.count >= LOGIN_ATTEMPT_LIMIT) {
      attempt.lockedUntil = Date.now() + LOGIN_LOCKOUT_TIME * 1000

      await kv.put(
        `${LOGIN_ATTEMPT_PREFIX}${ip}`,
        JSON.stringify(attempt),
        { expirationTtl: LOGIN_LOCKOUT_TIME }
      )

      return {
        attemptsLeft: 0,
        locked: true,
        lockoutTime: LOGIN_LOCKOUT_TIME
      }
    }

    // 更新尝试记录
    await kv.put(
      `${LOGIN_ATTEMPT_PREFIX}${ip}`,
      JSON.stringify(attempt),
      { expirationTtl: LOGIN_LOCKOUT_TIME }
    )

    return {
      attemptsLeft: LOGIN_ATTEMPT_LIMIT - attempt.count,
      locked: false
    }
  } catch {
    return { attemptsLeft: LOGIN_ATTEMPT_LIMIT, locked: false }
  }
}

/**
 * 清除登录失败记录（登录成功后调用）
 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  const kv = await getKV()
  if (!kv) return

  try {
    await kv.delete(`${LOGIN_ATTEMPT_PREFIX}${ip}`)
  } catch {
    // 忽略错误
  }
}
