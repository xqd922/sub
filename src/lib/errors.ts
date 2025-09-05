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
  SUBSCRIPTION_FETCH_FAILED = 'SUBSCRIPTION_FETCH_FAILED',
  SUBSCRIPTION_PARSE_FAILED = 'SUBSCRIPTION_PARSE_FAILED',
  SUBSCRIPTION_EMPTY = 'SUBSCRIPTION_EMPTY',
  SUBSCRIPTION_FORMAT_UNSUPPORTED = 'SUBSCRIPTION_FORMAT_UNSUPPORTED',
  
  // 节点相关错误
  PROXY_PARSE_FAILED = 'PROXY_PARSE_FAILED',
  PROXY_VALIDATION_FAILED = 'PROXY_VALIDATION_FAILED',
  PROXY_CONNECTION_FAILED = 'PROXY_CONNECTION_FAILED',
  
  // 安全相关错误
  SSRF_DETECTED = 'SSRF_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  
  // 短链接相关错误
  SHORTURL_SERVICE_UNAVAILABLE = 'SHORTURL_SERVICE_UNAVAILABLE',
  SHORTURL_GENERATION_FAILED = 'SHORTURL_GENERATION_FAILED',
  
  // 配置生成错误
  CONFIG_GENERATION_FAILED = 'CONFIG_GENERATION_FAILED',
  CONFIG_FORMAT_INVALID = 'CONFIG_FORMAT_INVALID'
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
    public readonly cause?: Error
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
      [ErrorCode.SUBSCRIPTION_FETCH_FAILED]: '无法获取订阅内容，请检查链接是否可访问',
      [ErrorCode.SUBSCRIPTION_PARSE_FAILED]: '订阅内容解析失败，可能是格式不支持或内容损坏',
      [ErrorCode.SUBSCRIPTION_EMPTY]: '订阅中没有找到有效的代理节点',
      [ErrorCode.PROXY_PARSE_FAILED]: '代理节点格式错误，无法解析',
      [ErrorCode.SSRF_DETECTED]: '不允许访问内网地址',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后再试',
      [ErrorCode.SHORTURL_GENERATION_FAILED]: '短链接生成失败，请稍后重试',
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络状况',
      [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
      [ErrorCode.CONFIG_GENERATION_FAILED]: '配置文件生成失败'
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
   * 静态方法：从普通错误创建AppError
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
   * 静态方法：创建验证错误
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
   * 静态方法：创建网络错误
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
   * 静态方法：创建超时错误
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

  /**
   * 静态方法：创建SSRF检测错误
   */
  static ssrf(url: string): AppError {
    return new AppError(
      ErrorCode.SSRF_DETECTED,
      '检测到SSRF攻击尝试，拒绝访问内网地址',
      403,
      ErrorSeverity.HIGH,
      { url, clientIp: 'hidden' }
    )
  }

  /**
   * 静态方法：创建频率限制错误
   */
  static rateLimit(
    remainingTime?: number,
    maxRequests?: number
  ): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      '请求过于频繁，请稍后再试',
      429,
      ErrorSeverity.MEDIUM,
      { remainingTime, maxRequests }
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

    fetchFailed: (url: string, cause?: Error) => new AppError(
      ErrorCode.SUBSCRIPTION_FETCH_FAILED,
      '订阅获取失败',
      502,
      ErrorSeverity.HIGH,
      { url },
      cause
    ),

    parseFailed: (reason?: string, cause?: Error) => new AppError(
      ErrorCode.SUBSCRIPTION_PARSE_FAILED,
      `订阅解析失败${reason ? `: ${reason}` : ''}`,
      422,
      ErrorSeverity.MEDIUM,
      { reason },
      cause
    ),

    empty: () => new AppError(
      ErrorCode.SUBSCRIPTION_EMPTY,
      '订阅中没有找到有效的代理节点',
      422,
      ErrorSeverity.MEDIUM
    )
  }

  /**
   * 代理节点相关错误
   */
  static proxy = {
    parseFailed: (nodeData: string, cause?: Error) => new AppError(
      ErrorCode.PROXY_PARSE_FAILED,
      '代理节点解析失败',
      422,
      ErrorSeverity.MEDIUM,
      { nodeData: nodeData.substring(0, 100) + '...' },
      cause
    ),

    validationFailed: (field: string, value: unknown) => new AppError(
      ErrorCode.PROXY_VALIDATION_FAILED,
      `代理节点验证失败：${field}`,
      422,
      ErrorSeverity.MEDIUM,
      { field, value }
    )
  }

  /**
   * 配置生成相关错误
   */
  static config = {
    generationFailed: (configType: string, cause?: Error) => new AppError(
      ErrorCode.CONFIG_GENERATION_FAILED,
      `${configType}配置生成失败`,
      500,
      ErrorSeverity.HIGH,
      { configType },
      cause
    )
  }
}