import { NextResponse } from 'next/server'

export const runtime = 'edge'

// TODO: 短链接管理 API — GET 列表、POST 创建
export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
