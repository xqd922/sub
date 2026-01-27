/**
 * 支持的代理协议常量
 */

/** 支持的协议前缀列表 */
export const SUPPORTED_PROTOCOLS = [
  'ss://',
  'vmess://',
  'trojan://',
  'vless://',
  'hysteria2://',
  'hy2://',
  'socks://',
  'anytls://'
] as const

/** 协议前缀类型 */
export type ProtocolPrefix = typeof SUPPORTED_PROTOCOLS[number]

/**
 * 检查 URL 是否为支持的单节点协议链接
 */
export function isProtocolUrl(url: string): boolean {
  return SUPPORTED_PROTOCOLS.some(protocol => url.startsWith(protocol))
}

/**
 * 检查 URL 是否为 Gist URL
 */
export function isGistUrl(url: string): boolean {
  return url.includes('gist.githubusercontent.com')
}

/**
 * 检查是否需要格式化节点名称
 * - 单节点链接不需要格式化
 * - Gist 链接不需要格式化
 */
export function shouldFormatNodeNames(url: string): boolean {
  return !isProtocolUrl(url) && !isGistUrl(url)
}
