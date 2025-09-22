import { useState } from 'react'
import { useClipboard } from './useClipboard'
import { useToast } from './useToast'

export function useUrlConverter() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [convertedUrl, setConvertedUrl] = useState('')
  const { copyToClipboard } = useClipboard()
  const { showToast } = useToast()

  const handleConvert = async () => {
    if (!inputUrl) {
      setError('请输入订阅链接')
      return
    }
    
    setError('')
    setLoading(true)
    
    try {
      const baseUrl = window.location.origin
      const encodedUrl = encodeURIComponent(inputUrl)
      const convertedUrl = `${baseUrl}/sub?url=${encodedUrl}`
      setConvertedUrl(convertedUrl)

      const copied = await copyToClipboard(convertedUrl)
      showToast(copied ? '已复制到剪贴板' : '转换成功', copied ? 'success' : 'info')
    } catch {
      setError('转换失败，请稍后重试')
      showToast('转换失败，请稍后重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string) => {
    const copied = await copyToClipboard(text)
    showToast(copied ? '已复制到剪贴板' : '复制失败', copied ? 'success' : 'error')
  }

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