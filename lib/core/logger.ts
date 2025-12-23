/**
 * 日志系统
 * 支持敏感信息脱敏，区分本地/云端环境
 */

/**
 * 脱敏处理敏感信息
 * @param args 日志参数
 * @returns 脱敏后的参数
 */
function maskSensitiveInfo(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      // 脱敏代理协议链接
      let maskedArg = arg.replace(/(ss|vmess|trojan|vless|hysteria2|hy2):\/\/[^\s]+/gi, '$1://***')
      // 脱敏 HTTP/HTTPS URL 路径和参数
      maskedArg = maskedArg.replace(/(https?:\/\/[^\/\s]+)\/[^\s]*/gi, '$1/***')
      return maskedArg
    }
    return arg
  })
}

/** 检测是否为生产环境 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** 检测是否在 Vercel 环境 */
function isVercel(): boolean {
  return !!process.env.VERCEL
}

/** 检测是否在云端环境（生产或 Vercel） */
function isCloudEnvironment(): boolean {
  return isProduction() || isVercel()
}

/**
 * 日志类
 * 云端环境自动脱敏，本地环境原始输出
 */
class Logger {
  /** 通用日志方法 */
  log(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      console.log(...maskSensitiveInfo(args))
    } else {
      console.log(...args)
    }
  }

  /** 调试日志 */
  debug = this.log
  /** 信息日志 */
  info = this.log
  /** 警告日志 */
  warn = this.log
  /** 错误日志 */
  error = this.log

  /**
   * 性能调试
   * @param label 标签名
   * @param fn 要测量的函数
   */
  perf(label: string, fn: () => void): void {
    console.time(label)
    fn()
    console.timeEnd(label)
  }

  /** 强制脱敏输出（任何环境） */
  safe(...args: unknown[]): void {
    console.log(...maskSensitiveInfo(args))
  }

  /** 强制原始输出（任何环境） */
  raw(...args: unknown[]): void {
    console.log(...args)
  }
}

export const logger = new Logger()
