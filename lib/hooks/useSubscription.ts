'use client'

import { useState } from 'react'
import { convertSubscriptionUrl, generateShortLink } from '../api/subscription'
import { copyToClipboard } from '../utils/clipboard'
import { showToast } from '../../app/components/ui/Toast'

/**
 * 订阅转换Hook
 * 管理订阅转换和短链接生成的状态和逻辑
 */
export function useSubscription() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shortenLoading, setShortenLoading] = useState(false)
  const [error, setError] = useState('')
  const [convertedUrl, setConvertedUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')

  /**
   * 处理订阅转换
   */
  const handleConvert = async () => {
    if (!inputUrl) {
      setError('请输入订阅链接')
      return
    }
    
    setError('')
    setLoading(true)
    setShortUrl('') // 重置短链接
    
    try {
      const convertedUrl = convertSubscriptionUrl(inputUrl)
      setConvertedUrl(convertedUrl)

      // 尝试自动复制
      const copied = await copyToClipboard(convertedUrl)
      showToast(copied ? '已复制到剪贴板' : '转换成功')
    } catch (error) {
      setError(error instanceof Error ? error.message : '转换失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 处理生成短链接
   */
  const handleGenerateShortUrl = async () => {
    if (!convertedUrl) return
    
    setShortenLoading(true)
    try {
      const data = await generateShortLink(convertedUrl)
      if (data.shortUrl) {
        setShortUrl(data.shortUrl)
        // 尝试自动复制短链接
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制到剪贴板' : '短链接已生成')
      }
    } catch (error) {
      console.error('生成短链接失败', error)
      showToast('生成短链接失败')
    } finally {
      setShortenLoading(false)
    }
  }

  /**
   * 处理复制文本
   */
  const handleCopy = async (text: string) => {
    const copied = await copyToClipboard(text)
    showToast(copied ? '已复制到剪贴板' : '复制失败')
  }

  return {
    inputUrl,
    setInputUrl,
    loading,
    shortenLoading,
    error,
    convertedUrl,
    shortUrl,
    handleConvert,
    handleGenerateShortUrl,
    handleCopy
  }
} 