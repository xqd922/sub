export enum ErrorCode {

  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  SUBSCRIPTION_URL_INVALID = 'SUBSCRIPTION_URL_INVALID',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

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

    this.requestId = this.generateRequestId()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }

    if (cause && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }

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

  toUserMessage(): string {
    const userMessages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.SUBSCRIPTION_URL_INVALID]: '订阅链接格式不正确，请检查URL是否有效',
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络状况',
      [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
    }

    return userMessages[this.code] || this.message || '发生未知错误，请稍后重试'
  }

  private generateRequestId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

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

export class ErrorFactory {

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