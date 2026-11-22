import { useState, useCallback } from 'react'
import { useClipboard } from './use-clipboard'
import { useToast } from './use-toast'

export function useUrlConverter() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [convertedUrl, setConvertedUrl] = useState('')
  const { copyToClipboard } = useClipboard()
  const { showToast } = useToast()

  const handleConvert = useCallback(async (overrideUrl?: string) => {
    const raw = (overrideUrl !== undefined ? overrideUrl : inputUrl).trim()

    if (!raw) {
      setError('请先粘贴链接')
      return ''
    }

    if (overrideUrl !== undefined) {
      setInputUrl(raw)
    }

    setError('')
    setLoading(true)

    try {
      const baseUrl = window.location.origin
      const encodedUrl = encodeURIComponent(raw)
      const nextConvertedUrl = `${baseUrl}/sub?url=${encodedUrl}`
      setConvertedUrl(nextConvertedUrl)
      setLoading(false)

      // 剪贴板复制放在 loading 释放之后，避免在失焦或权限弹窗时卡住按钮状态
      void copyToClipboard(nextConvertedUrl).then((copied) => {
        showToast(copied ? '已生成并复制到剪贴板' : '订阅链接已生成', copied ? 'success' : 'info')
      })

      return nextConvertedUrl
    } catch {
      setLoading(false)
      setError('转换失败，请稍后重试')
      showToast('转换失败，请稍后重试', 'error')
      return ''
    }
  }, [inputUrl, copyToClipboard, showToast])

  const handleCopy = useCallback(async (text: string): Promise<boolean> => {
    const copied = await copyToClipboard(text)
    showToast(copied ? '已复制到剪贴板' : '复制失败', copied ? 'success' : 'error')
    return copied
  }, [copyToClipboard, showToast])

  return {
    inputUrl,
    setInputUrl,
    loading,
    error,
    convertedUrl,
    handleConvert,
    handleCopy
  }
}
