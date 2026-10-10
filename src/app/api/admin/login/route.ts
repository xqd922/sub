import { NextResponse } from 'next/server'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { ADMIN_COOKIE_NAME, SESSION_TTL_MS, createSessionToken } from '@/auth/session'
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, getClientIp } from '@/auth/guard'
import { appendLoginAttempt } from '@/auth/login-log'

export const runtime = 'edge'

export async function POST(request: Request) {
  const ip = getClientIp(request)

  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(AppError.validation('请求体格式错误').toResponse(), { status: 400 })
  }

  const { username, password } = body
  if (!password || typeof password !== 'string') {
    return NextResponse.json(AppError.validation('请输入密码', 'password').toResponse(), { status: 400 })
  }

  const expectedPassword = process.env.ADMIN_PASSWORD
  if (!expectedPassword) {
    const error = new AppError(
      ErrorCode.AUTH_FAILED,
      '服务端未配置管理员密码，请在环境变量中设置 ADMIN_PASSWORD',
      500,
      ErrorSeverity.CRITICAL
    )
    return NextResponse.json(error.toResponse(), { status: 500 })
  }

  const limit = checkLoginRateLimit(ip)
  if (!limit.allowed) {
    const error = new AppError(
      ErrorCode.RATE_LIMITED,
      `登录尝试次数过多，请在 ${limit.retryAfterSec} 秒后重试`,
      429,
      ErrorSeverity.MEDIUM,
      { retryAfterSec: limit.retryAfterSec }
    )
    return NextResponse.json(error.toResponse(), {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSec) }
    })
  }

  const expectedUsername = process.env.ADMIN_USERNAME
  const usernameValid = !expectedUsername || username === expectedUsername
  const passwordValid = password === expectedPassword

  const userAgent = request.headers.get('user-agent') || undefined

  if (!usernameValid || !passwordValid) {
    recordFailedLogin(ip)
    await appendLoginAttempt({ time: Date.now(), ip, ok: false, userAgent })

    const error = new AppError(ErrorCode.AUTH_FAILED, '用户名或密码错误', 401, ErrorSeverity.MEDIUM)
    return NextResponse.json(error.toResponse(), { status: 401 })
  }

  clearLoginAttempts(ip)
  await appendLoginAttempt({ time: Date.now(), ip, ok: true, userAgent })

  const token = await createSessionToken()
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.NODE_ENV !== 'development'
  })
  return response
}
