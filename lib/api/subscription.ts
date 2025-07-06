/**
 * 订阅API服务
 * 处理订阅转换和短链接生成
 */

/**
 * 生成短链接
 * @param url 原始链接
 * @returns 包含短链接的对象
 */
export async function generateShortLink(url: string): Promise<{ shortUrl: string }> {
  const response = await fetch('/api/shorten', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url })
  })
  
  if (!response.ok) {
    throw new Error('短链接生成失败')
  }
  
  return response.json()
}

/**
 * 转换订阅链接
 * @param inputUrl 输入的订阅链接
 * @returns 转换后的链接
 */
export function convertSubscriptionUrl(inputUrl: string): string {
  if (!inputUrl) {
    throw new Error('请输入有效的订阅链接')
  }
  
  const baseUrl = window.location.origin
  const encodedUrl = encodeURIComponent(inputUrl)
  return `${baseUrl}/sub?url=${encodedUrl}`
} 