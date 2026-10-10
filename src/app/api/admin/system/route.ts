import { NextResponse } from 'next/server'
import { AppError } from '@/infra/error'
import { requireAdmin } from '@/auth/guard'
import { isAvailable } from '@/infra/kv/index'
import { getLoginLog } from '@/auth/login-log'
import { logger } from '@/infra/logger'

export const runtime = 'edge'

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) {
    return NextResponse.json(denied.toResponse(), { status: denied.statusCode })
  }

  try {
    const [kvAvailable, loginLog] = await Promise.all([isAvailable(), getLoginLog()])

    return NextResponse.json({
      success: true,
      config: {
        adminUsername: !!process.env.ADMIN_USERNAME,
        adminPassword: !!process.env.ADMIN_PASSWORD,
        adminSecret: !!process.env.ADMIN_SECRET,
        sink: !!(process.env.SINK_URL && process.env.SINK_TOKEN),
        bitly: !!process.env.BITLY_API_TOKEN,
        cuttly: !!process.env.CUTTLY_TOKEN,
        siteUrl: !!process.env.SITE_URL
      },
      kvAvailable,
      loginLog
    })
  } catch (error) {
    logger.error('[Admin] 获取系统状态失败:', error)
    return NextResponse.json(AppError.fromError(error as Error).toResponse(), { status: 500 })
  }
}
