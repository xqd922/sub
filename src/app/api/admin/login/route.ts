import { NextResponse } from 'next/server'
import { appendLoginAttempt } from '@/modules/admin-auth/login-audit.repository'
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '@/modules/admin-auth/rate-limit.service'
import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  createSessionToken,
  verifySecretEqual,
} from '@/modules/admin-auth/session.service'
import { getAdminCredentials, isDevelopment } from '@/server/env.config'
import { AppError, ErrorCode, ErrorSeverity } from '@/server/app-error'
import { getClientIp, jsonError, parseJsonBody } from '@/server/route.utils'

export const runtime = 'edge'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const body = await parseJsonBody<{ username?: string; password?: string }>(request)
  if (!body) {
    return jsonError(AppError.validation('请求体格式错误'))
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username) {
    return jsonError(AppError.validation('请输入管理员用户名', 'username'))
  }
  if (!password) {
    return jsonError(AppError.validation('请输入密码', 'password'))
  }

  const { username: expectedUsername, password: expectedPassword } = getAdminCredentials()
  if (!expectedUsername || !expectedPassword) {
    return jsonError(
      new AppError(
        ErrorCode.AUTH_FAILED,
        '服务端未配置管理员凭据，请在环境变量中设置 ADMIN_USERNAME 与 ADMIN_PASSWORD',
        500,
        ErrorSeverity.CRITICAL,
      ),
    )
  }

  const limit = checkLoginRateLimit(ip)
  if (!limit.allowed) {
    return jsonError(AppError.rateLimited(limit.retryAfterSec), {
      'Retry-After': String(limit.retryAfterSec),
    })
  }

  const [usernameValid, passwordValid] = await Promise.all([
    verifySecretEqual(username, expectedUsername),
    verifySecretEqual(password, expectedPassword),
  ])

  const userAgent = request.headers.get('user-agent') || undefined

  if (!usernameValid || !passwordValid) {
    recordFailedLogin(ip)
    await appendLoginAttempt({ time: Date.now(), ip, ok: false, userAgent })
    return jsonError(AppError.unauthorized('用户名或密码错误'))
  }

  clearLoginAttempts(ip)
  await appendLoginAttempt({ time: Date.now(), ip, ok: true, userAgent })

  const token = await createSessionToken()
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
    secure: !isDevelopment(),
  })
  return response
}
