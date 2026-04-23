import type { ConvertRecord, ShortLink, UnifiedItem } from '../types'

export function buildAdminItems(records: ConvertRecord[], shortLinks: ShortLink[]): UnifiedItem[] {
  return [
    ...records.map((record): UnifiedItem => ({
      id: record.id,
      name: record.name,
      type: 'convert',
      url: record.originalUrl,
      hits: record.hits,
      lastAccess: record.lastAccess,
      clientType: record.clientType,
      nodeCount: record.nodeCount
    })),
    ...shortLinks.map((shortLink): UnifiedItem => ({
      id: shortLink.id,
      name: shortLink.name,
      type: 'shortlink',
      url: shortLink.targetUrl,
      hits: shortLink.hits,
      lastAccess: shortLink.lastAccess
    }))
  ]
}

export function buildShareLink(item: UnifiedItem, origin: string): string {
  return item.type === 'convert'
    ? `${origin}/sub?url=${encodeURIComponent(item.url)}`
    : `${origin}/s/${item.id}`
}

export function formatAdminDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

export function formatCompactUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const path = parsedUrl.pathname.length > 15
      ? `${parsedUrl.pathname.slice(0, 15)}...`
      : parsedUrl.pathname

    return `${parsedUrl.hostname}${path}`
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}...` : url
  }
}
