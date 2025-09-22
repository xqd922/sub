/**
 * 脱敏处理函数
 */
function maskSensitiveInfo(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      // 脱敏代理协议链接 (ss://, vmess://, trojan://, vless://, hysteria2://, hy2://)
      let maskedArg = arg.replace(/(ss|vmess|trojan|vless|hysteria2|hy2):\/\/[^\s]+/gi, '$1://***')

      // 脱敏HTTP/HTTPS URL - 保留协议和域名，路径和参数全脱敏
      maskedArg = maskedArg.replace(/(https?:\/\/[^\/\s]+)\/[^\s]*/gi, '$1/***')

      return maskedArg
    }
    return arg
  })
}

/**
 * 环境检测
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function isVercel(): boolean {
  return !!process.env.VERCEL
}

function isCloudEnvironment(): boolean {
  return isProduction() || isVercel()
}

class Logger {
  log(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      // 云端环境：脱敏输出
      console.log(...maskSensitiveInfo(args))
    } else {
      // 本地环境：原始输出
      console.log(...args)
    }
  }

  // 兼容旧的方法名
  debug = this.log
  info = this.log
  warn = this.log
  error = this.log

  // 性能调试专用方法
  perf(label: string, fn: () => void): void {
    console.time(label)
    fn()
    console.timeEnd(label)
  }

  // 强制脱敏方法（无论什么环境都脱敏）
  safe(...args: unknown[]): void {
    console.log(...maskSensitiveInfo(args))
  }

  // 强制原始输出方法（无论什么环境都不脱敏）
  raw(...args: unknown[]): void {
    console.log(...args)
  }
}

export const logger = new Logger()