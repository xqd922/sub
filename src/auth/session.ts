import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'

export const ADMIN_COOKIE_NAME = 'admin_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000)

export interface AdminSessionPayload {
  iat: number
  exp: number
}

function getSessionSecret(): string {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function createSessionToken(nowMs: number = Date.now()): Promise<string> {
  const secret = getSessionSecret()
  if (!secret) {
    throw new AppError(
      ErrorCode.AUTH_FAILED,
      '未配置管理员凭据，请设置 ADMIN_PASSWORD 环境变量',
      500,
      ErrorSeverity.CRITICAL
    )
  }

  const payload: AdminSessionPayload = { iat: nowMs, exp: nowMs + SESSION_TTL_MS }
  const payloadBase64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))

  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadBase64))

  return `${payloadBase64}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifySessionToken(token: string, nowMs: number = Date.now()): Promise<AdminSessionPayload | null> {
  const secret = getSessionSecret()
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const key = await importHmacKey(secret)
    const signatureBytes = base64UrlToBytes(parts[1])
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(parts[0]))
    if (!isValid) return null

    const json = new TextDecoder().decode(base64UrlToBytes(parts[0]))
    const parsed = JSON.parse(json) as Partial<AdminSessionPayload>
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
    `Max-Age=${SESSION_MAX_AGE_SEC}`
  ]
  if (process.env.NODE_ENV !== 'development') {
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
