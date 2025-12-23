/**
 * 错误报告模块
 * 负责错误的记录、上报和日志输出
 */

import { AppError, ErrorSeverity } from './errors'
import { logger } from '../core/logger'

/** 错误上下文信息 */
interface ErrorContext {
  url?: string
  userAgent?: string
  clientIp?: string
  userId?: string
  sessionId?: string
  requestBody?: unknown
  additionalData?: Record<string, unknown>
}

/** 错误报告 */
interface ErrorReport {
  error: AppError
  context: ErrorContext
  environment: 'development' | 'production' | 'test'
}

/**
 * 错误报告器（单例模式）
 * 负责错误的记录和日志输出
 */
export class ErrorReporter {
  private static instance: ErrorReporter

  private constructor() {}

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /** 报告错误 */
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

  /** 记录错误到日志 */
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

  /** 脱敏 IP 地址 */
  private maskIp(ip?: string): string | undefined {
    if (!ip) return undefined

    // IPv4: 192.168.1.100 -> 192.168.*.**
    if (ip.includes('.')) {
      const parts = ip.split('.')
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.***`
      }
    }

    // IPv6
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
 * @param error 错误对象
 * @param context 错误上下文
 * @returns 转换后的 AppError
 */
export async function handleError(
  error: Error | AppError,
  context: ErrorContext = {}
): Promise<AppError> {
  const appError = error instanceof AppError ? error : AppError.fromError(error)
  const reporter = ErrorReporter.getInstance()
  await reporter.report(appError, context)
  return appError
}

/**
 * 创建错误响应
 * @param error 应用错误
 * @returns 包含状态码和响应体的对象
 */
export function createErrorResponse(error: AppError) {
  return {
    status: error.statusCode,
    body: error.toResponse()
  }
}
