export function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1)
  }
  return host
}

export function formatHostForUri(host: string): string {
  return host.includes(':') ? `[${host}]` : host
}

export function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function extractFragmentName(url: URL, fallback: string): string {
  return url.hash ? safeDecodeUriComponent(url.hash.slice(1)) || fallback : fallback
}

export function cleanStringHeaders(
  headers?: Record<string, string | undefined>,
): Record<string, string> {
  if (!headers) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

export function normalizeAlpnList(alpn?: string[] | string): string[] | undefined {
  if (!alpn) return undefined
  return Array.isArray(alpn) ? [...alpn] : [alpn]
}
