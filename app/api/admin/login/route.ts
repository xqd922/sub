import { NextResponse } from 'next/server'
import {
  createSession,
  isLoginLocked,
  recordFailedLogin,
  clearLoginAttempts
} from '@/lib/auth'

export const runtime = 'edge'

/**
 * POST /api/admin/login - 管理员登录
 */
export async function POST(request: Request) {
  // 获取客户端 IP
  const ip = request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-forwarded-for')?.split(',')[0] ||
             'unknown'

  try {
    // 检查 IP 是否被锁定
    const lockStatus = await isLoginLocked(ip)
    if (lockStatus.locked) {
      return NextResponse.json(
        {
          error: `登录尝试次数过多，请 ${lockStatus.remainingTime} 秒后重试`,
          locked: true,
          remainingTime: lockStatus.remainingTime
        },
        { status: 429 }
      )
    }

    const body = await request.json() as { username?: string; password?: string }
    const { username, password } = body

    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD

    // 检查是否配置了密码
    if (!adminPassword) {
      return NextResponse.json(
        { error: '管理员密码未配置' },
        { status: 500 }
      )
    }

    // 验证用户名和密码
    if (username !== adminUsername || password !== adminPassword) {
      // 记录登录失败
      const result = await recordFailedLogin(ip)

      if (result.locked) {
        return NextResponse.json(
          {
            error: `登录失败次数过多，账户已锁定 ${result.lockoutTime} 秒`,
            locked: true,
            lockoutTime: result.lockoutTime
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error: '用户名或密码错误',
          attemptsLeft: result.attemptsLeft
        },
        { status: 401 }
      )
    }

    // 登录成功，清除失败记录
    await clearLoginAttempts(ip)

    const userAgent = request.headers.get('user-agent') || undefined

    // 创建 session 并存储到 KV
    const token = await createSession(adminUsername, ip, userAgent)

    if (!token) {
      return NextResponse.json(
        { error: 'Session 创建失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token,
      username: adminUsername,
      expiresIn: 24 * 60 * 60 // 24小时后过期
    })

  } catch {
    return NextResponse.json(
      { error: '请求格式错误' },
      { status: 400 }
    )
  }
}
