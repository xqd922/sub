import type { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/modules/admin-auth/session.service'
import { AppError } from '@/server/app-error'
import { jsonError } from '@/server/route.utils'
import { logger } from '@/server/logger'

export async function requireAdmin(request: Request): Promise<AppError | null> {
  const session = await getSessionFromRequest(request)
  return session ? null : AppError.unauthorized()
}

export function withAdminAuth<TContext = unknown>(
  actionLabel: string,
  handler: (request: Request, context: TContext) => Promise<NextResponse>,
): (request: Request, context: TContext) => Promise<NextResponse> {
  return async (request: Request, context: TContext) => {
    const denied = await requireAdmin(request)
    if (denied) {
      return jsonError(denied)
    }

    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof AppError) {
        return jsonError(error)
      }
      logger.error(`[Admin] ${actionLabel}失败:`, error)
      return jsonError(AppError.fromUnknown(error))
    }
  }
}
