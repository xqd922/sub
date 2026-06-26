/**
 * 应用错误码枚举
 * 使用统一的错误码便于错误分类和处理
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 订阅相关错误
  SUBSCRIPTION_URL_INVALID = 'SUBSCRIPTION_URL_INVALID',
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 统一的应用错误类
 * 提供结构化的错误信息，便于统一处理和日志记录
 */
export class AppError extends Error {
  public readonly timestamp: string
  public readonly requestId?: string

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly metadata?: Record<string, unknown>,
    public override readonly cause?: Error
  ) {
    super(message)
    this.name = 'AppError'
    this.timestamp = new Date().toISOString()

    // 生成请求ID用于错误追踪
    this.requestId = this.generateRequestId()

    // 保持错误堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }

    // 如果有原因错误，保持其堆栈信息
    if (cause && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }

  /**
   * 转换为API响应格式
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        severity: this.severity,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        requestId: this.requestId,
        ...(this.metadata && { metadata: this.metadata })
      }
    }
  }

  /**
   * 转换为用户友好的错误信息
   */
  toUserMessage(): string {
    const userMessages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.SUBSCRIPTION_URL_INVALID]: '订阅链接格式不正确，请检查URL是否有效',
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络状况',
      [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
    }

    return userMessages[this.code] || this.message || '发生未知错误，请稍后重试'
  }

  /**
   * 生成唯一的请求ID
   */
  private generateRequestId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * 从普通错误创建AppError
   */
  static fromError(
    error: Error,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    metadata?: Record<string, unknown>
  ): AppError {
    return new AppError(
      code,
      error.message,
      statusCode,
      ErrorSeverity.MEDIUM,
      metadata,
      error
    )
  }

  /**
   * 创建验证错误
   */
  static validation(
    message: string,
    field?: string,
    value?: unknown
  ): AppError {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      ErrorSeverity.LOW,
      { field, value }
    )
  }

  /**
   * 创建网络错误
   */
  static network(
    message: string,
    url?: string,
    statusCode?: number
  ): AppError {
    return new AppError(
      ErrorCode.NETWORK_ERROR,
      message,
      502,
      ErrorSeverity.HIGH,
      { url, httpStatusCode: statusCode }
    )
  }

  /**
   * 创建超时错误
   */
  static timeout(
    message: string = '请求超时',
    timeoutMs?: number
  ): AppError {
    return new AppError(
      ErrorCode.TIMEOUT_ERROR,
      message,
      408,
      ErrorSeverity.MEDIUM,
      { timeoutMs }
    )
  }
}

/**
 * 错误工厂类
 * 提供便捷的错误创建方法
 */
export class ErrorFactory {
  /**
   * 订阅相关错误
   */
  static subscription = {
    invalidUrl: (url: string) => new AppError(
      ErrorCode.SUBSCRIPTION_URL_INVALID,
      '订阅链接格式不正确',
      400,
      ErrorSeverity.LOW,
      { url }
    ),
  }
}
