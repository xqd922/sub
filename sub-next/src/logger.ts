function maskSensitiveInfo(args: unknown[]): unknown[] {
  return args.map(arg => {
    if (typeof arg === 'string') {

      let maskedArg = arg.replace(/(ss|vmess|trojan|vless|hysteria2|hy2):\/\/[^\s]+/gi, '$1://***')

      maskedArg = maskedArg.replace(/(https?:\/\/[^\/\s]+)\/[^\s]*/gi, '$1/***')
      return maskedArg
    }
    return arg
  })
}

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
      console.log(...maskSensitiveInfo(args))
    } else {
      console.log(...args)
    }
  }

  debug(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      console.debug(...maskSensitiveInfo(args))
    } else {
      console.debug(...args)
    }
  }

  info(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      console.log(...maskSensitiveInfo(args))
    } else {
      console.log(...args)
    }
  }

  warn(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      console.warn(...maskSensitiveInfo(args))
    } else {
      console.warn(...args)
    }
  }

  error(...args: unknown[]): void {
    if (isCloudEnvironment()) {
      console.error(...maskSensitiveInfo(args))
    } else {
      console.error(...args)
    }
  }

  perf(label: string, fn: () => void): void {
    console.time(label)
    fn()
    console.timeEnd(label)
  }

  safe(...args: unknown[]): void {
    console.log(...maskSensitiveInfo(args))
  }

  raw(...args: unknown[]): void {
    console.log(...args)
  }
}

export const logger = new Logger()