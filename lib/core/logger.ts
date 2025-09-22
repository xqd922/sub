type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  
  private shouldLog(level: LogLevel): boolean {
    // 所有环境都输出所有级别的日志
    return true
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(...args)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(...args)
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(...args)
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