import type { ApiErrorPayload } from '@/shared/types/admin.types'

export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SUBSCRIPTION_URL_INVALID = 'SUBSCRIPTION_URL_INVALID',
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

const USER_FRIENDLY_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.SUBSCRIPTION_URL_INVALID]: '订阅链接格式不正确，请检查 URL 是否有效',
  [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络状况',
  [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
}

function generateRequestId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

export class AppError extends Error {
  public readonly timestamp: string
  public readonly requestId: string

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly metadata?: Record<string, unknown>,
    public override readonly cause?: Error,
  ) {
    super(message)
    this.name = 'AppError'
    this.timestamp = new Date().toISOString()
    this.requestId = generateRequestId()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }

    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }

  toResponse(): ApiErrorPayload {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        severity: this.severity,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        requestId: this.requestId,
        ...(this.metadata ? { metadata: this.metadata } : {}),
      },
    }
  }

  toUserMessage(): string {
    return USER_FRIENDLY_MESSAGES[this.code] || this.message || '发生未知错误，请稍后重试'
  }

  withMetadata(extra: Record<string, unknown>): AppError {
    return new AppError(
      this.code,
      this.message,
      this.statusCode,
      this.severity,
      { ...this.metadata, ...extra },
      this.cause,
    )
  }

  static fromUnknown(
    error: unknown,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ): AppError {
    if (error instanceof AppError) return error
    if (error instanceof Error) {
      return new AppError(code, error.message, statusCode, ErrorSeverity.MEDIUM, metadata, error)
    }
    return new AppError(code, '发生未知错误', statusCode, ErrorSeverity.MEDIUM, {
      ...metadata,
      originalError: String(error),
    })
  }

  static validation(message: string, field?: string, value?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, ErrorSeverity.LOW, {
      ...(field !== undefined ? { field } : {}),
      ...(value !== undefined ? { value } : {}),
    })
  }

  static invalidSubscriptionUrl(url: string): AppError {
    return new AppError(
      ErrorCode.SUBSCRIPTION_URL_INVALID,
      '订阅链接格式不正确',
      400,
      ErrorSeverity.LOW,
      { url },
    )
  }

  static unauthorized(message = '未登录或会话已过期'): AppError {
    return new AppError(ErrorCode.AUTH_FAILED, message, 401, ErrorSeverity.MEDIUM)
  }

  static notFound(message: string, metadata?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404, ErrorSeverity.LOW, metadata)
  }

  static rateLimited(retryAfterSec: number): AppError {
    return new AppError(
      ErrorCode.RATE_LIMITED,
      `登录尝试次数过多，请在 ${retryAfterSec} 秒后重试`,
      429,
      ErrorSeverity.MEDIUM,
      { retryAfterSec },
    )
  }

  static network(message: string, url?: string, httpStatusCode?: number): AppError {
    return new AppError(ErrorCode.NETWORK_ERROR, message, 502, ErrorSeverity.HIGH, {
      url,
      httpStatusCode,
    })
  }

  static timeout(message = '请求超时，请稍后重试', timeoutMs?: number): AppError {
    return new AppError(ErrorCode.TIMEOUT_ERROR, message, 408, ErrorSeverity.MEDIUM, {
      timeoutMs,
    })
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(ErrorCode.SERVICE_UNAVAILABLE, message, 503, ErrorSeverity.MEDIUM)
  }
}
