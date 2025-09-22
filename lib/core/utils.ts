// 格式化字节数
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 添加用户友好的错误提示
export function userFriendlyMessage(status: number): string {
  switch (status) {
    case 521:
      return '订阅服务器暂时不可用，请稍后再试'
    case 404:
      return '订阅链接无效或已过期'
    case 403:
      return '无权访问此订阅'
    default:
      return '订阅获取失败，请检查链接是否正确'
  }
} 