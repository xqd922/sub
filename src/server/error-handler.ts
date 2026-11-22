import { AppError, ErrorSeverity } from '@/server/app-error'
import { logger } from '@/server/logger'

export interface ErrorContext {
  url?: string
  userAgent?: string
  clientIp?: string
  additionalData?: Record<string, unknown>
}

export function maskIp(ip?: string): string | undefined {
  if (!ip) return undefined

  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`
    }
  }

  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:*:*:*:*:*:*`
    }
  }

  return 'masked'
}

export function reportError(error: unknown, context: ErrorContext = {}): AppError {
  const appError = AppError.fromUnknown(error)
  const logData = {
    code: appError.code,
    message: appError.message,
    severity: appError.severity,
    statusCode: appError.statusCode,
    requestId: appError.requestId,
    timestamp: appError.timestamp,
    url: context.url,
    userAgent: context.userAgent?.slice(0, 200),
    clientIp: maskIp(context.clientIp),
    metadata: appError.metadata,
    additionalData: context.additionalData,
    stack: appError.stack,
  }

  switch (appError.severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('CRITICAL ERROR', logData)
      break
    case ErrorSeverity.HIGH:
      logger.error('HIGH ERROR', logData)
      break
    case ErrorSeverity.MEDIUM:
      logger.warn('MEDIUM ERROR', logData)
      break
    case ErrorSeverity.LOW:
      logger.info('LOW ERROR', logData)
      break
  }

  return appError
}
