'use client'

import React from 'react'
import { AppError, ErrorSeverity, ErrorCode } from '@/lib/errors'

interface ErrorDisplayProps {
  error: AppError | string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  showDetails?: boolean
}

/**
 * 错误显示组件
 * 用于在UI中显示错误信息
 */
export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '',
  showDetails = false 
}: ErrorDisplayProps) {
  const appError = typeof error === 'string' 
    ? new AppError(ErrorCode.UNKNOWN_ERROR, error)
    : error

  const severityStyles = {
    [ErrorSeverity.LOW]: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200',
    [ErrorSeverity.MEDIUM]: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200',
    [ErrorSeverity.HIGH]: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-200',
    [ErrorSeverity.CRITICAL]: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
  }

  const severityIcons = {
    [ErrorSeverity.LOW]: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    [ErrorSeverity.MEDIUM]: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    [ErrorSeverity.HIGH]: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    [ErrorSeverity.CRITICAL]: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
      </svg>
    )
  }

  const baseClasses = `border rounded-lg p-4 ${className}`
  const severityClass = severityStyles[appError.severity] || severityStyles[ErrorSeverity.MEDIUM]

  return (
    <div className={`${baseClasses} ${severityClass}`}>
      <div className="flex items-start">
        {/* 错误图标 */}
        <div className="flex-shrink-0 mr-3">
          {severityIcons[appError.severity] || severityIcons[ErrorSeverity.MEDIUM]}
        </div>
        
        <div className="flex-grow min-w-0">
          {/* 错误消息 */}
          <div className="font-medium mb-1">
            {appError.toUserMessage()}
          </div>
          
          {/* 错误ID */}
          {appError.requestId && (
            <div className="text-sm opacity-75 mb-2">
              错误ID: <code className="font-mono">{appError.requestId}</code>
            </div>
          )}
          
          {/* 详细信息 */}
          {showDetails && appError.metadata && (
            <details className="mt-2">
              <summary className="text-sm cursor-pointer hover:underline">
                查看详细信息
              </summary>
              <div className="mt-2 text-xs">
                <div className="bg-black bg-opacity-10 rounded p-2">
                  <div><strong>错误码:</strong> {appError.code}</div>
                  <div><strong>时间:</strong> {new Date(appError.timestamp).toLocaleString()}</div>
                  {appError.metadata && (
                    <div>
                      <strong>详细信息:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        {JSON.stringify(appError.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
        
        {/* 操作按钮区域 */}
        <div className="flex-shrink-0 ml-3 flex items-center space-x-2">
          {/* 重试按钮 */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm font-medium hover:underline focus:outline-none focus:underline"
              title="重试"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          
          {/* 关闭按钮 */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm font-medium hover:underline focus:outline-none focus:underline"
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 简单的错误提示组件
 */
interface ErrorToastProps {
  error: AppError | string
  onDismiss?: () => void
  autoHide?: boolean
  duration?: number
}

export function ErrorToast({ 
  error, 
  onDismiss, 
  autoHide = true, 
  duration = 5000 
}: ErrorToastProps) {
  const appError = typeof error === 'string' 
    ? new AppError(ErrorCode.UNKNOWN_ERROR, error)
    : error

  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
  }, [autoHide, duration, onDismiss])

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg dark:bg-red-900/90 dark:border-red-700 dark:text-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{appError.toUserMessage()}</span>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-2 text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 内联错误组件（用于表单验证等）
 */
interface InlineErrorProps {
  error: AppError | string | null
  className?: string
}

export function InlineError({ error, className = '' }: InlineErrorProps) {
  if (!error) return null

  const message = typeof error === 'string' ? error : error.toUserMessage()

  return (
    <div className={`flex items-center text-sm text-red-600 dark:text-red-400 mt-1 ${className}`}>
      <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}