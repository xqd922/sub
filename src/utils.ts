export function parsePort(value: string | number | undefined | null, defaultPort = 443): number {
  const port = typeof value === 'number' ? value : parseInt(String(value))
  if (isNaN(port) || port < 1 || port > 65535) return defaultPort
  return port
}

export function extractNameFromUrl(url: string, fallback = '未知订阅'): string {
  try {
    const urlObj = new URL(url)

    const name = urlObj.searchParams.get('name') ||
                 urlObj.searchParams.get('remarks') ||
                 urlObj.searchParams.get('tag')
    if (name) return decodeURIComponent(name)

    const innerUrl = urlObj.searchParams.get('url')
    if (innerUrl) {
      const decoded = decodeURIComponent(innerUrl)
      const inner = new URL(decoded)
      const innerName = inner.searchParams.get('name') ||
                        inner.searchParams.get('remarks') ||
                        inner.searchParams.get('tag')
      if (innerName) return decodeURIComponent(innerName)
    }

    return urlObj.hostname || fallback
  } catch {
    return fallback
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}