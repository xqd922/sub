import { NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireAdmin, withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  LOGIN_WINDOW_MS,
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '@/modules/admin-auth/rate-limit.service'
import {
  ADMIN_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  parseSessionCookie,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  verifySecretEqual,
  verifySessionToken,
} from '@/modules/admin-auth/session.service'
import { ErrorCode } from '@/server/app-error'

const FIXED_NOW = 1_750_000_000_000
const TEST_PASSWORD = 'test-admin-password'

describe('admin session tokens', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
  })

  it('roundtrips tokens and enforces expiry boundaries', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const valid = await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS - 1)
    expect(valid).not.toBeNull()
    expect(valid!.exp - valid!.iat).toBe(SESSION_TTL_MS)

    expect(await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS)).toBeNull()
    expect(await verifySessionToken(token, FIXED_NOW + SESSION_TTL_MS + 1)).toBeNull()
  })

  it('rejects tampered payloads, tampered signatures, wrong secrets, and garbage inputs', async () => {
    const token = await createSessionToken(FIXED_NOW)
    const [payload, signature] = token.split('.')
    const tamperedPayload = (payload[0] === 'A' ? 'B' : 'A') + payload.slice(1)
    const tamperedSig = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)

    expect(await verifySessionToken(`${tamperedPayload}.${signature}`, FIXED_NOW)).toBeNull()
    expect(await verifySessionToken(`${payload}.${tamperedSig}`, FIXED_NOW)).toBeNull()

    process.env.ADMIN_PASSWORD = 'different-password'
    expect(await verifySessionToken(token, FIXED_NOW)).toBeNull()

    for (const malformed of ['abc', 'a.b.c', '.sig', 'pay.', '', '$$$$.%%%%']) {
      expect(await verifySessionToken(malformed, FIXED_NOW)).toBeNull()
    }
  })

  it('prefers ADMIN_SECRET over ADMIN_PASSWORD and fails closed when unconfigured', async () => {
    process.env.ADMIN_SECRET = 'secret-a'
    const token = await createSessionToken(FIXED_NOW)

    process.env.ADMIN_PASSWORD = 'changed-password'
    expect(await verifySessionToken(token, FIXED_NOW)).not.toBeNull()

    process.env.ADMIN_SECRET = 'secret-b'
    expect(await verifySessionToken(token, FIXED_NOW)).toBeNull()

    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
    await expect(createSessionToken(FIXED_NOW)).rejects.toMatchObject({
      code: ErrorCode.AUTH_FAILED,
    })
  })

  it('compares secrets with constant-time HMAC helper', async () => {
    expect(await verifySecretEqual('super-secret', 'super-secret')).toBe(true)
    expect(await verifySecretEqual('super-secret', 'super-secrex')).toBe(false)
    expect(await verifySecretEqual('short', 'much-longer-secret')).toBe(false)
  })
})

describe('session cookie helpers', () => {
  const savedNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: savedNodeEnv,
      writable: true,
      configurable: true,
      enumerable: true,
    })
  })

  it('parses session cookies cleanly', () => {
    const makeReq = (cookie?: string) =>
      new Request('https://example.com/api/admin/stats', {
        headers: cookie ? { cookie } : {},
      })

    expect(parseSessionCookie(makeReq(`a=1; ${ADMIN_COOKIE_NAME}=tok; b=2`))).toBe('tok')
    expect(parseSessionCookie(makeReq('a=1; b=2'))).toBeNull()
    expect(parseSessionCookie(makeReq())).toBeNull()
    expect(parseSessionCookie(makeReq(`${ADMIN_COOKIE_NAME}=`))).toBeNull()
  })

  it('serializes secure cookie in production, non-secure in development, and clears properly', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
      enumerable: true,
    })
    const prodCookie = serializeSessionCookie('tok')
    expect(prodCookie).toContain(`${ADMIN_COOKIE_NAME}=tok`)
    expect(prodCookie).toContain('HttpOnly')
    expect(prodCookie).toContain('SameSite=Lax')
    expect(prodCookie).toContain('Secure')

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
      enumerable: true,
    })
    expect(serializeSessionCookie('tok')).not.toContain('Secure')
    expect(serializeClearedSessionCookie()).toContain('Max-Age=0')
  })
})

describe('admin guard and rate limiting', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD
    clearLoginAttempts('1.2.3.4')
  })

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD
    clearLoginAttempts('1.2.3.4')
  })

  it('guards requests via requireAdmin and withAdminAuth', async () => {
    const token = await createSessionToken(Date.now())
    const authedReq = new Request('https://example.com/api/admin/stats', {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
    })
    const unauthedReq = new Request('https://example.com/api/admin/stats')

    expect(await requireAdmin(authedReq)).toBeNull()
    expect((await requireAdmin(unauthedReq))?.statusCode).toBe(401)

    const wrapped = withAdminAuth('测试', async () => NextResponse.json({ success: true }))
    expect((await wrapped(authedReq, undefined)).status).toBe(200)
    expect((await wrapped(unauthedReq, undefined)).status).toBe(401)
  })

  it('enforces IP rate limit window and resets on clear', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(true)
      recordFailedLogin('1.2.3.4', FIXED_NOW)
    }

    const blocked = checkLoginRateLimit('1.2.3.4', FIXED_NOW)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(LOGIN_WINDOW_MS / 1000)

    expect(checkLoginRateLimit('5.6.7.8', FIXED_NOW).allowed).toBe(true)
    expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW + LOGIN_WINDOW_MS).allowed).toBe(true)

    clearLoginAttempts('1.2.3.4')
    expect(checkLoginRateLimit('1.2.3.4', FIXED_NOW).allowed).toBe(true)
  })
})
