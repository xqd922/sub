import { NextResponse } from 'next/server'
import { AppError } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { pingKV } from '@/infra/kv/maintenance'
import { logger } from '@/infra/logger'

export const runtime = 'edge'

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  try {
    const result = await pingKV()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('[Admin] KV 连通性测试失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}
