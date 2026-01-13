import { NextResponse } from 'next/server'
import { generateSessionToken } from '@/lib/auth'

export const runtime = 'edge'

/**
 * POST /api/admin/login - 管理员登录
 */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    // 生成 session token（与验证时使用相同算法）
    const token = await generateSessionToken()
    if (!token) {
      return NextResponse.json(
        { error: '生成 token 失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token,
      username: adminUsername
    })

  } catch {
    return NextResponse.json(
      { error: '请求格式错误' },
      { status: 400 }
    )
  }
}
