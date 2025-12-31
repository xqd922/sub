/**
 * 格式化工具函数
 */

// 相对时间格式化
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`

  return new Date(timestamp).toLocaleDateString('zh-CN')
}

// 完整日期格式化
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// URL 缩略显示
export function formatUrl(url: string, maxLen = 40): string {
  try {
    const u = new URL(url)
    const display = `${u.hostname}${u.pathname}`
    return display.length > maxLen ? display.slice(0, maxLen) + '...' : display
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url
  }
}

// 提取订阅名称
export function extractName(url: string): string {
  try {
    const u = new URL(url)
    const name = u.searchParams.get('name') || u.searchParams.get('remarks')
    if (name) return decodeURIComponent(name)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return '未知'
  }
}

// 数字格式化（带千分位）
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}
