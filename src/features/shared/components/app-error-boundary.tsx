'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RiErrorWarningLine, RiRefreshLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'

interface AppErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface AppErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorId?: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
    if (process.env.NODE_ENV === 'development') {
      console.error('[AppErrorBoundary]', error, errorInfo.componentStack)
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined })
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry)
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          retry={this.retry}
        />
      )
    }

    return this.props.children
  }
}

function DefaultErrorFallback({
  error,
  errorId,
  retry,
}: {
  error: Error
  errorId?: string
  retry: () => void
}) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-secondary-default p-4 text-text-primary">
      <div className="w-full max-w-md rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
        <div className="mb-4 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-notification-error-background text-notification-error-foreground">
            <RiErrorWarningLine className="size-6" aria-hidden />
          </div>
        </div>

        <h1 className="mb-2 text-center text-title-3-medium text-text-primary">出现错误</h1>
        <p className="mb-4 text-center text-body-regular text-text-secondary">
          {error.message || '页面发生未知错误，请稍后重试'}
        </p>

        {errorId ? (
          <div className="mb-4 rounded-xl border border-separator-border bg-background-secondary-default p-3">
            <div className="mb-1 text-caption-1-medium text-text-tertiary">错误 ID</div>
            <code dir="ltr" className="font-mono text-caption-1-regular text-text-primary">
              {errorId}
            </code>
          </div>
        ) : null}

        {isDev && error.stack ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-body-2-medium text-text-secondary">
              开发者信息
            </summary>
            <div className="rounded-xl border border-separator-border bg-background-secondary-default p-3 text-caption-1-regular text-text-secondary">
              <pre
                dir="ltr"
                className="overflow-x-auto whitespace-pre-wrap font-mono text-caption-2-regular"
              >
                {error.stack}
              </pre>
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
