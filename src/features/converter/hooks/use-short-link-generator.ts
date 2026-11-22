import { useCallback, useState } from 'react'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { useToast } from '@/features/shared/hooks/use-toast'

export function useShortLinkGenerator() {
  const [shortUrl, setShortUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { copyToClipboard } = useClipboard()
  const { showToast } = useToast()

  const generate = useCallback(
    async (longUrl: string): Promise<string | null> => {
      if (!longUrl) return null

      setLoading(true)
      try {
        const response = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: longUrl }),
        })

        if (!response.ok) {
          throw new Error('短链接生成服务暂时不可用，请稍后重试')
        }

        const data = (await response.json()) as { shortUrl?: string }
        if (!data.shortUrl) {
          throw new Error('未获取到短链接')
        }

        setShortUrl(data.shortUrl)
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制到剪贴板' : '短链接已生成', 'success')
        return data.shortUrl
      } catch (error) {
        showToast(error instanceof Error ? error.message : '生成短链接失败', 'error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [copyToClipboard, showToast],
  )

  const reset = useCallback(() => {
    setShortUrl('')
  }, [])

  return {
    shortUrl,
    loading,
    generate,
    reset,
  }
}
