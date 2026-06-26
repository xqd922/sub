import { NextResponse } from 'next/server'

export const runtime = 'edge'

// TODO: 统计数据 API — GET 聚合统计
export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
