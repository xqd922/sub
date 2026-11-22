'use client'

import { Component, ReactNode, ErrorInfo } from 'react'
import { RiErrorWarningLine, RiRefreshLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { AppError, ErrorCode, ErrorSeverity } from '@/infra/error'
import { handleError } from '@/infra/error-reporter'
import { logger } from '@/infra/logger'

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

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            ErrorCode.UNKNOWN_ERROR,
            error.message || '应用发生未知错误',
            500,
            ErrorSeverity.HIGH,
            {
              originalError: error.name,
              stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            },
          )

    return {
      hasError: true,
      error: appError,
      errorId: appError.requestId,
    }
  }

  override async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      const appError = this.state.error || AppError.fromError(error)

      const enhancedError = new AppError(
        appError.code,
        appError.message,
        appError.statusCode,
        appError.severity,
        {
          ...appError.metadata,
          componentStack: errorInfo.componentStack?.split('\n').slice(0, 10).join('\n'),
          errorBoundary: true,
        },
        appError.cause,
      )

      await handleError(enhancedError, {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        additionalData: {
          reactErrorInfo: errorInfo,
          timestamp: new Date().toISOString(),
        },
      })

      this.props.onError?.(enhancedError, errorInfo)

      if (process.env.NODE_ENV === 'development') {
        logger.error('React Error Boundary caught an error:', {
          error: enhancedError,
          errorInfo,
          componentStack: errorInfo.componentStack,
        })
      }
    } catch (reportingError) {
      logger.error('Failed to report error from Error Boundary:', reportingError)
      logger.error('Original error:', error)
    }
  }

  retry = () => {
    this.setState({ hasError: false })
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry)
      }

      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error: AppError
  retry: () => void
}

function DefaultErrorFallback({ error, retry }: DefaultErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-secondary-default p-4 text-text-primary">
      <div className="w-full max-w-md rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
        <div className="mb-4 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-notification-error-background text-notification-error-foreground">
            <RiErrorWarningLine className="size-6" aria-hidden />
          </div>
        </div>

        <h1 className="mb-2 text-center text-title-3-medium text-text-primary">出现错误</h1>
        <p className="mb-4 text-center text-body-regular text-text-secondary">{error.toUserMessage()}</p>

        <div className="mb-4 rounded-xl border border-separator-border bg-background-secondary-default p-3">
          <div className="mb-1 text-caption-1-medium text-text-tertiary">错误 ID</div>
          <code dir="ltr" className="font-mono text-caption-1-regular text-text-primary">
            {error.requestId}
          </code>
        </div>

        {isDevelopment ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-body-2-medium text-text-secondary">
              开发者信息
            </summary>
            <div className="rounded-xl border border-separator-border bg-background-secondary-default p-3 text-caption-1-regular text-text-secondary">
              <div className="mb-1.5">
                <span className="font-medium text-text-primary">错误码：</span>
                <code className="ms-1 font-mono">{error.code}</code>
              </div>
              <div className="mb-1.5">
                <span className="font-medium text-text-primary">严重级别：</span>
                <span className="ms-1">{error.severity}</span>
              </div>
              {error.stack ? (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-caption-2-regular">
                  {error.stack}
                </pre>
              ) : null}
            </div>
          </details>
        ) : null}

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={retry}>
            重试
          </Button>
          <Button
            variant="secondary"
            leadingIcon={RiRefreshLine}
            className="flex-1"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        </div>
      </div>
    </div>
  )
}
