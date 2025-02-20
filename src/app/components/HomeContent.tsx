'use client'

import { useState } from 'react'

// 安全的复制函数
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代 API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // 如果 clipboard API 失败，回退到传统方法
      }
    }

    // 传统方法作为回退
    const textArea = document.createElement('textarea')
    textArea.value = text
    // 确保文本区域在视口内但不可见
    textArea.style.cssText = 'position:fixed;top:50%;left:50%;opacity:0;'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      textArea.remove()
      return true
    } catch (err) {
      console.error('复制失败:', err)
      textArea.remove()
      return false
    }
  } catch (err) {
    console.error('复制失败:', err)
    return false
  }
}

export default function HomeContent() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shortenLoading, setShortenLoading] = useState(false)
  const [error, setError] = useState('')
  const [convertedUrl, setConvertedUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')

  const handleConvert = async () => {
    if (!inputUrl) {
      setError('请输入订阅链接')
      return
    }
    
    setError('')
    setLoading(true)
    setShortUrl('') // 重置短链接
    
    try {
      const baseUrl = window.location.origin
      const encodedUrl = encodeURIComponent(inputUrl)
      // 使用统一的订阅链接
      const convertedUrl = `${baseUrl}/sub?url=${encodedUrl}`
      setConvertedUrl(convertedUrl)

      // 尝试自动复制
      const copied = await copyToClipboard(convertedUrl)
      showToast(copied ? '已复制到剪贴板' : '转换成功')
    } catch {
      setError('转换失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateShortUrl = async () => {
    if (!convertedUrl) return
    
    setShortenLoading(true)
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: convertedUrl })
      })
      
      if (!response.ok) {
        throw new Error('短链接生成失败')
      }
      
      const data = await response.json()
      if (data.shortUrl) {
        setShortUrl(data.shortUrl)
        // 尝试自动复制短链接
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制到剪贴板' : '短链接已生成')
      }
    } catch {
      console.error('生成短链接失败')
      showToast('生成短链接失败')
    } finally {
      setShortenLoading(false)
    }
  }

  // 处理复制按钮点击
  const handleCopy = async (text: string) => {
    const copied = await copyToClipboard(text)
    showToast(copied ? '已复制到剪贴板' : '复制失败')
  }

  const showToast = (message: string) => {
    const toast = document.createElement('div')
    toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-up'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.classList.add('animate-fade-out')
      setTimeout(() => document.body.removeChild(toast), 300)
    }, 2000)
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-start justify-center p-4 sm:p-6">
      <section className="w-full max-w-xl mt-24">
        <div className="text-center space-y-1 mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            通用订阅转换
          </h1>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="在此输入你的订阅链接"
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/50 dark:bg-black/50 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
          />

          <button
            onClick={handleConvert}
            disabled={loading}
            className="relative w-full py-2.5 sm:py-3 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl disabled:opacity-50 transition-all hover:opacity-90 hover:shadow-lg hover:shadow-gray-500/10 overflow-hidden"
          >
            {loading && (
              <div className="absolute inset-0 w-full h-full">
                <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 animate-progress-indeterminate"></div>
              </div>
            )}
            <div className="relative">
              {loading ? '转换中...' : '转换'}
            </div>
          </button>

          {error && (
            <div className="text-[10px] sm:text-xs text-red-500/90 text-center">
              {error}
            </div>
          )}

          {convertedUrl && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">订阅链接</span>
                  <button
                    onClick={() => handleCopy(convertedUrl)}
                    className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600"
                  >
                    复制
                  </button>
                </div>
                <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
                  {convertedUrl}
                </div>
              </div>

              {!shortUrl && (
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
                  <button
                    onClick={handleGenerateShortUrl}
                    disabled={shortenLoading}
                    className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {shortenLoading ? '生成中...' : '生成短链接'}
                  </button>
                </div>
              )}

              {shortUrl && (
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shortUrl)
                        showToast('已复制短链接')
                      }}
                      className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      复制
                    </button>
                  </div>
                  <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
                    {shortUrl}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </section>
  )
} 