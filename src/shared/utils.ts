/**
 * 通用工具函数
 */

/**
 * 安全解析端口号，无效时返回默认值
 * @param value 端口字符串或数字
 * @param defaultPort 默认端口（默认 443）
 * @returns 有效的端口号 (1-65535)
 */
export function parsePort(value: string | number | undefined | null, defaultPort = 443): number {
  const port = typeof value === 'number' ? value : parseInt(String(value))
  if (isNaN(port) || port < 1 || port > 65535) return defaultPort
  return port
}

/**
 * 格式化字节数为可读字符串
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "1.50 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
