import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ADMIN_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
  parseSessionCookie,
  serializeSessionCookie,
  serializeClearedSessionCookie
} from '@/auth/session'
import {
  requireAdmin,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  LOGIN_WINDOW_MS
} from '@/auth/guard'
import { ErrorCode } from '@/infra/error'

const FIXED_NOW = 1_750_000_000_000
const TEST_PASSWORD = 'test-admin-password'

describe('createSessionToken / verifySessionToken', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  it('roundtrips a freshly created token', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const session = await verifySessionToken(token, FIXED_NOW + 1000)

    expect(session).not.toBeNull()
    expect(session!.iat).toBe(FIXED_NOW)
    expect(session!.exp - session!.iat).toBe(SESSION_TTL_MS)
  })

  it('accepts a token one millisecond before expiry', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const session = await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS - 1)

    expect(session).not.toBeNull()
  })

  it('rejects a token at exact expiry time', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const session = await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS)

    expect(session).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const session = await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS + 1)

    expect(session).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const [payload, signature] = token.split('.')
    const tamperedPayload = (payload[0] === 'A' ? 'B' : 'A') + payload.slice(1)

    expect(await verifySessionToken(`${tamperedPayload}.${signature}`, FIXED_NOW)).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const [payload, signature] = token.split('.')
    const tamperedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)

    expect(await verifySessionToken(`${payload}.${tamperedSignature}`, FIXED_NOW)).toBeNull()
  })

  it('rejects a valid token signed with a different secret', async () => {
    process.env.ADMIN_PASSWORD = 'password-one'
    const token = await createSessionToken(FIXED_NOW)

    process.env.ADMIN_PASSWORD = 'password-two'
    expect(await verifySessionToken(token, FIXED_NOW)).toBeNull()
  })

  it('prefers ADMIN_SECRET over ADMIN_PASSWORD as signing key', async () => {
    process.env.ADMIN_PASSWORD = 'password-a'
    process.env.ADMIN_SECRET = 'secret-a'
    const token = await createSessionToken(FIXED_NOW)

    process.env.ADMIN_PASSWORD = 'password-b'
    expect(await verifySessionToken(token, FIXED_NOW)).not.toBeNull()

    process.env.ADMIN_SECRET = 'secret-b'
    expect(await verifySessionToken(token, FIXED_NOW)).toBeNull()
  })

  it.each(['abc', 'a.b.c', '.sig', 'pay.', '', '!!!.###'])('returns null for malformed token "%s"', async (token) => {
    expect(await verifySessionToken(token, FIXED_NOW)).toBeNull()
  })

  it('never throws on garbage base64 input', async () => {
    await expect(verifySessionToken('$$$$.%%%%', FIXED_NOW)).resolves.toBeNull()
  })
})

describe('createSessionToken without configured secret', () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  it('fails closed with AUTH_FAILED when no secret is set', async () => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET

    await expect(createSessionToken(FIXED_NOW)).rejects.toMatchObject({
      code: ErrorCode.AUTH_FAILED
    })
  })
})

describe('parseSessionCookie', () => {
  const makeRequest = (cookie?: string) =>
    new Request('https://example.com/api/admin/stats', {
      headers: cookie ? { cookie } : {}
    })

  it('extracts the admin session cookie among others', () => {
    const request = makeRequest(`a=1; ${ADMIN_COOKIE_NAME}=tok; b=2`)
    expect(parseSessionCookie(request)).toBe('tok')
  })

  it('returns null when the cookie is absent', () => {
    expect(parseSessionCookie(makeRequest('a=1; b=2'))).toBeNull()
    expect(parseSessionCookie(makeRequest())).toBeNull()
  })

  it('returns null for an empty cookie value', () => {
    expect(parseSessionCookie(makeRequest(`${ADMIN_COOKIE_NAME}=`))).toBeNull()
  })
})

describe('serializeSessionCookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes standard flags in production and adds Secure', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const cookie = serializeSessionCookie('tok')

    expect(cookie).toContain(`${ADMIN_COOKIE_NAME}=tok`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`)
    expect(cookie).toContain('Secure')
  })

  it('omits Secure in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(serializeSessionCookie('tok')).not.toContain('Secure')
  })

  it('clears the cookie with Max-Age=0', () => {
    expect(serializeClearedSessionCookie()).toContain('Max-Age=0')
  })
})

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  it('returns null for a request with a valid session cookie', async () => {
    const now = Date.now()
    const token = await createSessionToken(now)
    const request = new Request('https://example.com/api/admin/stats', {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` }
    })

    expect(await requireAdmin(request)).toBeNull()
  })

  it('returns a 401 AUTH_FAILED error without a cookie', async () => {
    const request = new Request('https://example.com/api/admin/stats')

    const error = await requireAdmin(request)
    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(401)
    expect(error!.code).toBe(ErrorCode.AUTH_FAILED)
  })

  it('returns a 401 error with a forged cookie', async () => {
    const request = new Request('https://example.com/api/admin/stats', {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=forged.token` }
    })

    const error = await requireAdmin(request)
    expect(error).not.toBeNull()
    expect(error!.statusCode).toBe(401)
  })
})

describe('login rate limiting', () => {
  beforeEach(() => {
    clearLoginAttempts('1.2.3.4')
  })

  afterEach(() => {
    clearLoginAttempts('1.2.3.4')
  })

  it('allows up to the max failed attempts then blocks', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(true)
      recordFailedLogin('1.2.3.4', FIXED_NOW)
    }

    const result = checkLoginRateLimit('1.2.3.4', FIXED_NOW)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSec).toBeGreaterThan(0)
    expect(result.retryAfterSec).toBeLessThanOrEqual(LOGIN_WINDOW_MS / 1000)
  })

  it('unblocks after the window passes', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin('1.2.3.4', FIXED_NOW)
    }
    expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(false)

    const later = FIXED_NOW + 10 * 60 * 1000
    expect(checkLoginRateLimit('1.2.3.4', later).allowed).toBe(true)
  })

  it('clearLoginAttempts resets the counter immediately', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin('1.2.3.4', FIXED_NOW)
    }
    expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(false)

    clearLoginAttempts('1.2.3.4')
    expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(true)
  })

  it('tracks ips independently', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin('1.2.3.4', FIXED_NOW)
    }
    expect(checkLoginRateLimit('5.6.7.8', FIXED_NOW).allowed).toBe(true)
  })
})
