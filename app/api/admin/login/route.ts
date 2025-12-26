import { NextResponse } from 'next/server'

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

    // 生成简单的 session token（基于时间戳和密码的 hash）
    const encoder = new TextEncoder()
    const data = encoder.encode(`${adminUsername}:${adminPassword}:${Date.now()}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const token = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

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
