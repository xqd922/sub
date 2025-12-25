import { useState } from 'react'
import { useClipboard } from './useClipboard'
import { useToast } from './useToast'

export function useShortUrl() {
  const [shortUrl, setShortUrl] = useState('')
  const [shortenLoading, setShortenLoading] = useState(false)
  const { copyToClipboard } = useClipboard()
  const { showToast } = useToast()

  const generateShortUrl = async (longUrl: string) => {
    if (!longUrl) return
    
    setShortenLoading(true)
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: longUrl })
      })
      
      if (!response.ok) {
        throw new Error('短链接生成服务暂时不可用，请稍后重试')
      }
      
      const data = await response.json() as { shortUrl?: string }
      if (data.shortUrl) {
        setShortUrl(data.shortUrl)
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制到剪贴板' : '短链接已生成', 'success')
      }
    } catch {
      showToast('生成短链接失败', 'error')
    } finally {
      setShortenLoading(false)
    }
  }

  return {
    shortUrl,
    shortenLoading,
    generateShortUrl,
    setShortUrl
  }
}