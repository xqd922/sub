export const SUPPORTED_PROTOCOLS = [
  'ss://',
  'vmess://',
  'trojan://',
  'vless://',
  'hysteria2://',
  'hy2://',
  'socks://',
  'anytls://',
  'snell://'
] as const

export type ProtocolPrefix = typeof SUPPORTED_PROTOCOLS[number]

export function isProtocolUrl(url: string): boolean {
  return SUPPORTED_PROTOCOLS.some(protocol => url.startsWith(protocol))
}

export function isGistUrl(url: string): boolean {
  return url.includes('gist.githubusercontent.com')
}

export function shouldFormatNodeNames(url: string): boolean {
  return !isProtocolUrl(url) && !isGistUrl(url)
}