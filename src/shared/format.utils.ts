export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const unit = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), sizes.length - 1)
  return `${(bytes / Math.pow(unit, index)).toFixed(2)} ${sizes[index]}`
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString('zh-CN')
}

export function formatShortDate(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

export function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}
