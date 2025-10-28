import { AppError, ErrorSeverity } from './errors'
import { logger } from '../core/logger'

/**
 * 错误上下文信息
 */
interface ErrorContext {
  url?: string | undefined
  userAgent?: string | undefined
  clientIp?: string | undefined
  userId?: string | undefined
  sessionId?: string | undefined
  requestBody?: unknown | undefined
  additionalData?: Record<string, unknown> | undefined
}

/**
 * 错误报告接口
 */
interface ErrorReport {
  error: AppError
  context: ErrorContext
  environment: 'development' | 'production' | 'test'
}

/**
 * 错误报告器（简化版）
 * 负责错误的记录和日志输出
 */
export class ErrorReporter {
  private static instance: ErrorReporter

  private constructor() {
    // 私有构造函数实现单例模式
  }

  public static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /**
   * 报告错误
   */
  async report(error: AppError, context: ErrorContext = {}): Promise<void> {
    const report: ErrorReport = {
      error,
      context: {
        ...context,
        // 避免记录敏感信息
        userAgent: context.userAgent?.substring(0, 200),
        clientIp: this.maskIp(context.clientIp),
      },
      environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test'
    }

    // 记录到日志
    this.logError(report)
  }

  /**
   * 记录错误到日志
   */
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

  /**
   * 脱敏IP地址
   */
  private maskIp(ip?: string): string | undefined {
    if (!ip) return undefined

    // 对IPv4地址进行脱敏：192.168.1.100 -> 192.168.*.***
    if (ip.includes('.')) {
      const parts = ip.split('.')
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.***`
      }
    }

    // 对IPv6地址进行脱敏
    if (ip.includes(':')) {
      const parts = ip.split(':')
      if (parts.length >= 4) {
        return `${parts[0]}:${parts[1]}:*:*:*:*:*:*`
      }
    }

    return 'masked'
  }
}

/**
 * 全局错误处理函数
 */
export async function handleError(
  error: Error | AppError,
  context: ErrorContext = {}
): Promise<AppError> {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else {
    // 将普通错误转换为AppError
    appError = AppError.fromError(error)
  }

  // 报告错误
  const reporter = ErrorReporter.getInstance()
  await reporter.report(appError, context)

  return appError
}

/**
 * Express/Next.js错误处理中间件辅助函数
 */
export function createErrorResponse(error: AppError) {
  return {
    status: error.statusCode,
    body: error.toResponse()
  }
}