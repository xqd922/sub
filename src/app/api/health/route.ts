import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 这里可以添加更多的健康检查逻辑
    // 比如检查数据库连接、外部服务等

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
} 