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

/** 将 UTC 小时键（YYYY-MM-DDTHH）格式化为本地时区 HH:00 */
export function formatHourTick(utcHourKey: string): string {
  const date = new Date(`${utcHourKey}:00:00Z`)
  if (Number.isNaN(date.getTime())) return utcHourKey.slice(11, 13) + ':00'
  return `${String(date.getHours()).padStart(2, '0')}:00`
}

/** 将 UTC 小时键（YYYY-MM-DDTHH）格式化为本地时区 MM/DD HH:00 */
export function formatHourDateTime(utcHourKey: string): string {
  const date = new Date(`${utcHourKey}:00:00Z`)
  if (Number.isNaN(date.getTime())) return utcHourKey
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:00`
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
