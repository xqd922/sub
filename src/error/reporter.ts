import { AppError, ErrorSeverity } from '@/error/errors'
import { logger } from '@/logger'

interface ErrorContext {
  url?: string
  userAgent?: string
  clientIp?: string
  userId?: string
  sessionId?: string
  requestBody?: unknown
  additionalData?: Record<string, unknown>
}

interface ErrorReport {
  error: AppError
  context: ErrorContext
  environment: 'development' | 'production' | 'test'
}

export class ErrorReporter {
  private static instance: ErrorReporter

  private constructor() {}

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  async report(error: AppError, context: ErrorContext = {}): Promise<void> {
    const report: ErrorReport = {
      error,
      context: {
        ...context,
        userAgent: context.userAgent?.substring(0, 200),
        clientIp: this.maskIp(context.clientIp),
      },
      environment: (process.env.NODE_ENV || 'development') as ErrorReport['environment']
    }

    this.logError(report)
  }

  private logError(report: ErrorReport): void {
    const { error, context } = report

    const logData = {
      code: error.code,
      message: error.message,
      severity: error.severity,
      statusCode: error.statusCode,
      requestId: error.requestId,
      timestamp: error.timestamp,
      url: context.url,
      userAgent: context.userAgent,
      metadata: error.metadata,
      stack: error.stack
    }

    switch (error.severity) {
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
      default:
        logger.error('UNKNOWN SEVERITY', logData)
    }
  }

  private maskIp(ip?: string): string | undefined {
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
}

export async function handleError(
  error: Error | AppError,
  context: ErrorContext = {}
): Promise<AppError> {
  const appError = error instanceof AppError ? error : AppError.fromError(error)
  const reporter = ErrorReporter.getInstance()
  await reporter.report(appError, context)
  return appError
}

export function createErrorResponse(error: AppError) {
  return {
    status: error.statusCode,
    body: error.toResponse()
  }
}