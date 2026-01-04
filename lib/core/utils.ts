/**
 * 通用工具函数
 */

/**
 * Edge Runtime 兼容的 Base64 解码
 * 使用 atob + TextDecoder 替代 Buffer.from
 */
export function decodeBase64(str: string): string {
  try {
    // 处理 URL-safe base64
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return atob(str)
  }
}

/**
 * Edge Runtime 兼容的 Base64 编码
 * 使用 btoa + TextEncoder 替代 Buffer.from().toString('base64')
 */
export function encodeBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  } catch {
    return btoa(str)
  }
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
