import { getSessionSecret, isDevelopment } from '@/server/config/env.config'
import { AppError, ErrorCode, ErrorSeverity } from '@/server/errors/app-error'
import { base64ToBytes, bytesToBase64Url } from '@/shared/utils/base64.utils'

export const ADMIN_COOKIE_NAME = 'admin_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000)

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface AdminSessionPayload {
  iat: number
  exp: number
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function verifySecretEqual(input: string, expected: string): Promise<boolean> {
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(input)),
    crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
  ])
  const bytesA = new Uint8Array(sigA)
  const bytesB = new Uint8Array(sigB)
  if (bytesA.length !== bytesB.length) return false

  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]
  }
  return diff === 0
}

export async function createSessionToken(nowMs: number = Date.now()): Promise<string> {
  const secret = getSessionSecret()
  if (!secret) {
    throw new AppError(
      ErrorCode.AUTH_FAILED,
      '未配置管理员凭据，请设置 ADMIN_PASSWORD 环境变量',
      500,
      ErrorSeverity.CRITICAL,
    )
  }

  const payload: AdminSessionPayload = { iat: nowMs, exp: nowMs + SESSION_TTL_MS }
  const payloadBase64 = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))

  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64))

  return `${payloadBase64}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifySessionToken(
  token: string,
  nowMs: number = Date.now(),
): Promise<AdminSessionPayload | null> {
  const secret = getSessionSecret()
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const key = await importHmacKey(secret)
    const signatureBytes = base64ToBytes(parts[1])
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(parts[0]),
    )
    if (!isValid) return null

    const parsed = JSON.parse(decoder.decode(base64ToBytes(parts[0]))) as Partial<AdminSessionPayload>
    if (typeof parsed.iat !== 'number' || typeof parsed.exp !== 'number') return null
    if (parsed.exp <= nowMs) return null

    return { iat: parsed.iat, exp: parsed.exp }
  } catch {
    return null
  }
}

export function parseSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    if (trimmed.slice(0, separatorIndex) === ADMIN_COOKIE_NAME) {
      return trimmed.slice(separatorIndex + 1) || null
    }
  }
  return null
}

export function serializeSessionCookie(token: string): string {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ]
  if (!isDevelopment()) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

export function serializeClearedSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export async function getSessionFromRequest(request: Request): Promise<AdminSessionPayload | null> {
  const token = parseSessionCookie(request)
  if (!token) return null
  return verifySessionToken(token)
}
