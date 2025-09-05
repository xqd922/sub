type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  
  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true
    
    // 生产环境只输出警告和错误
    return level === 'warn' || level === 'error'
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args)
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args)
    }
  }

  // 性能调试专用方法
  perf(label: string, fn: () => void): void {
    if (this.isDevelopment) {
      console.time(label)
      fn()
      console.timeEnd(label)
    } else {
      fn()
    }
  }

  // 条件日志 - 只在开发环境输出
  devOnly(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log(...args)
    }
  }
}

export const logger = new Logger()