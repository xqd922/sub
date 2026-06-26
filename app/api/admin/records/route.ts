import { NextResponse } from 'next/server'

export const runtime = 'edge'

// TODO: 转换记录 API — GET 列表、POST 查询
export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
