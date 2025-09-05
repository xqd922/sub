import { AppError, ErrorSeverity } from './errors'
import { logger } from './logger'

/**
 * 错误报告接口
 */
interface ErrorReport {
  error: AppError
  context: ErrorContext
  environment: 'development' | 'production' | 'test'
}

/**
 * 错误上下文信息
 */
interface ErrorContext {
  url?: string
  userAgent?: string
  clientIp?: string
  userId?: string
  sessionId?: string
  requestBody?: unknown
  additionalData?: Record<string, unknown>
}

/**
 * 错误报告器
 * 负责错误的记录、上报和监控
 */
export class ErrorReporter {
  private static instance: ErrorReporter
  private errorQueue: ErrorReport[] = []
  private isProcessing = false

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

    // 立即记录到日志
    this.logError(report)

    // 添加到队列等待处理
    this.errorQueue.push(report)

    // 异步处理错误报告
    this.processQueue()
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
        logger.error('[CRITICAL ERROR]', logData)
        break
      case ErrorSeverity.HIGH:
        logger.error('[HIGH ERROR]', logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn('[MEDIUM ERROR]', logData)
        break
      case ErrorSeverity.LOW:
        logger.info('[LOW ERROR]', logData)
        break
      default:
        logger.error('[UNKNOWN SEVERITY]', logData)
    }
  }

  /**
   * 处理错误队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.errorQueue.length > 0) {
        const report = this.errorQueue.shift()!
        
        // 只在生产环境发送错误报告
        if (process.env.NODE_ENV === 'production') {
          await this.sendErrorReport(report)
        }

        // 处理高严重性错误的特殊逻辑
        if (report.error.severity === ErrorSeverity.CRITICAL) {
          await this.handleCriticalError(report)
        }
      }
    } catch (error) {
      logger.error('错误报告处理失败:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 发送错误报告到外部服务
   */
  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      // 这里可以集成Sentry、LogRocket或其他错误监控服务
      if (process.env.ERROR_REPORTING_URL) {
        const response = await fetch(process.env.ERROR_REPORTING_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ERROR_REPORTING_TOKEN || ''}`
          },
          body: JSON.stringify({
            service: 'subscription-converter',
            version: process.env.npm_package_version || '1.0.0',
            error: {
              code: report.error.code,
              message: report.error.message,
              severity: report.error.severity,
              statusCode: report.error.statusCode,
              requestId: report.error.requestId,
              timestamp: report.error.timestamp,
              stack: report.error.stack,
              metadata: report.error.metadata
            },
            context: report.context,
            environment: report.environment
          })
        })

        if (!response.ok) {
          throw new Error(`错误报告发送失败: ${response.status}`)
        }
      }
    } catch (error) {
      logger.error('发送错误报告失败:', error)
    }
  }

  /**
   * 处理关键错误
   */
  private async handleCriticalError(report: ErrorReport): Promise<void> {
    try {
      // 关键错误的特殊处理逻辑
      logger.error('⚠️  CRITICAL ERROR DETECTED ⚠️ ', {
        requestId: report.error.requestId,
        code: report.error.code,
        message: report.error.message
      })

      // 可以在这里添加：
      // - 发送告警通知
      // - 触发熔断机制
      // - 记录到专门的关键错误日志
      
      if (process.env.CRITICAL_ERROR_WEBHOOK) {
        await fetch(process.env.CRITICAL_ERROR_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Critical Error in Subscription Converter: ${report.error.code}`,
            attachments: [{
              color: 'danger',
              fields: [{
                title: 'Error Code',
                value: report.error.code,
                short: true
              }, {
                title: 'Message',
                value: report.error.message,
                short: false
              }, {
                title: 'Request ID',
                value: report.error.requestId,
                short: true
              }, {
                title: 'Timestamp',
                value: report.error.timestamp,
                short: true
              }]
            }]
          })
        })
      }
    } catch (error) {
      logger.error('关键错误处理失败:', error)
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

  /**
   * 获取错误统计信息
   */
  getStats(): {
    queueLength: number
    isProcessing: boolean
    totalReported: number
  } {
    return {
      queueLength: this.errorQueue.length,
      isProcessing: this.isProcessing,
      totalReported: 0 // 可以添加计数器来跟踪总数
    }
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