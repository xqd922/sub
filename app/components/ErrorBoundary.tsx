'use client'

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { AppError, ErrorCode, ErrorSeverity } from '@/lib/error/errors'
import { handleError } from '@/lib/error/reporter'
import { logger } from '@/lib/core/logger'

interface ErrorBoundaryState {
  hasError: boolean
  error?: AppError
  errorId?: string | undefined
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ((error: AppError, retry: () => void) => ReactNode) | undefined
  onError?: ((error: AppError, errorInfo: ErrorInfo) => void) | undefined
}

/**
 * 全局错误边界组件
 * 捕获React组件树中的JavaScript错误，显示友好的错误界面
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 将普通错误转换为AppError
    const appError = error instanceof AppError 
      ? error 
      : new AppError(
          ErrorCode.UNKNOWN_ERROR,
          error.message || '应用发生未知错误',
          500,
          ErrorSeverity.HIGH,
          { 
            originalError: error.name,
            stack: error.stack?.split('\n').slice(0, 5).join('\n') // 只保留前5行堆栈
          }
        )

    return {
      hasError: true,
      error: appError,
      errorId: appError.requestId
    }
  }

  override async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      // 创建或使用现有的AppError
      const appError = this.state.error || AppError.fromError(error)
      
      // 添加React错误信息到metadata
      const enhancedError = new AppError(
        appError.code,
        appError.message,
        appError.statusCode,
        appError.severity,
        {
          ...appError.metadata,
          componentStack: errorInfo.componentStack?.split('\n').slice(0, 10).join('\n'),
          errorBoundary: true
        },
        appError.cause
      )

      // 报告错误
      await handleError(enhancedError, {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        additionalData: {
          reactErrorInfo: errorInfo,
          timestamp: new Date().toISOString()
        }
      })

      // 调用自定义错误处理函数
      this.props.onError?.(enhancedError, errorInfo)

      // 记录到控制台（开发环境）
      if (process.env.NODE_ENV === 'development') {
        logger.error('React Error Boundary caught an error:', {
          error: enhancedError,
          errorInfo,
          componentStack: errorInfo.componentStack
        })
      }
    } catch (reportingError) {
      // 错误报告失败时，至少记录到控制台
      logger.error('Failed to report error from Error Boundary:', reportingError)
      logger.error('Original error:', error)
    }
  }

  /**
   * 重试功能 - 重置错误状态
   */
  retry = () => {
    this.setState({
      hasError: false
    })
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      // 如果提供了自定义fallback，使用自定义UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry)
      }

      // 否则使用默认错误UI
      return (
        <DefaultErrorFallback 
          error={this.state.error}
          retry={this.retry}
        />
      )
    }

    return this.props.children
  }
}

/**
 * 默认错误回退组件
 */
interface DefaultErrorFallbackProps {
  error: AppError
  retry: () => void
}

function DefaultErrorFallback({ error, retry }: DefaultErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* 错误图标 */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg 
              className="w-6 h-6 text-red-600 dark:text-red-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        {/* 错误标题 */}
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
          出现错误
        </h1>

        {/* 用户友好的错误信息 */}
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
          {error.toUserMessage()}
        </p>

        {/* 错误ID（用于支持） */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">错误ID（用于技术支持）</div>
          <code className="text-xs font-mono text-gray-800 dark:text-gray-200">
            {error.requestId}
          </code>
        </div>

        {/* 开发环境显示详细错误信息 */}
        {isDevelopment && (
          <details className="mb-4">
            <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer mb-2">
              开发者信息
            </summary>
            <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 text-xs">
              <div className="mb-2">
                <span className="font-semibold">错误码：</span>
                <code className="ml-1">{error.code}</code>
              </div>
              <div className="mb-2">
                <span className="font-semibold">严重级别：</span>
                <span className="ml-1">{error.severity}</span>
              </div>
              {error.metadata && (
                <div className="mb-2">
                  <span className="font-semibold">元数据：</span>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(error.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {error.stack && (
                <div>
                  <span className="font-semibold">堆栈跟踪：</span>
                  <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={retry}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            刷新页面
          </button>
        </div>

        {/* 帮助链接 */}
        <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
          如果问题持续出现，请联系{' '}
          <a 
            href="https://github.com/anthropics/claude-code/issues" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            技术支持
          </a>
        </div>
      </div>
    </div>
  )
}