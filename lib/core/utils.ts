/**
 * 通用工具函数
 */

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
