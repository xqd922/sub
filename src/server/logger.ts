import { isProduction } from '@/server/env.config'

const PROXY_URI_RE = /(ss|vmess|trojan|vless|hysteria2|hy2|socks|anytls|snell):\/\/[^\s]+/gi
const HTTP_URL_RE = /(https?:\/\/[^/\s]+)\/[^\s]*/gi

function maskSensitiveArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg !== 'string') return arg
    return arg.replace(PROXY_URI_RE, '$1://***').replace(HTTP_URL_RE, '$1/***')
  })
}

function sanitize(args: unknown[]): unknown[] {
  return isProduction() ? maskSensitiveArgs(args) : args
}

export const logger = {
  log(...args: unknown[]): void {
    console.log(...sanitize(args))
  },
  debug(...args: unknown[]): void {
    console.debug(...sanitize(args))
  },
  info(...args: unknown[]): void {
    console.log(...sanitize(args))
  },
  warn(...args: unknown[]): void {
    console.warn(...sanitize(args))
  },
  error(...args: unknown[]): void {
    console.error(...sanitize(args))
  },
}
