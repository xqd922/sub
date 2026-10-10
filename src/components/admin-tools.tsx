'use client'

import { useState } from 'react'
import { useClipboard } from '@/components/use-clipboard'
import { showToast } from '@/components/use-toast'

export default function AdminTools() {
  const [inputUrl, setInputUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const { copyToClipboard } = useClipboard()

  const trimmedUrl = inputUrl.trim()
  const conversionUrl = trimmedUrl
    ? `${window.location.origin}/sub?url=${encodeURIComponent(trimmedUrl)}`
    : ''

  const handleCopyConversion = async () => {
    if (!conversionUrl) return
    const copied = await copyToClipboard(conversionUrl)
    showToast(copied ? '转换链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handlePreview = () => {
    if (!trimmedUrl) return
    window.open(`/sub?url=${encodeURIComponent(trimmedUrl)}`, '_blank')
  }

  const handleGenerateShortLink = async () => {
    if (!trimmedUrl || generating) return

    setGenerating(true)
    setShortUrl('')
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: conversionUrl })
      })

      if (!response.ok) {
        throw new Error('短链接生成服务暂时不可用')
      }

      const data = await response.json() as { shortUrl?: string }
      if (data.shortUrl) {
        setShortUrl(data.shortUrl)
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制' : '短链接已生成', 'success')
      } else {
        throw new Error('未获取到短链接')
      }
    } catch (error) {
      showToast((error as Error).message || '生成失败', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100'
  const buttonClass = 'px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 disabled:opacity-40 transition-all hover:opacity-90'
  const secondaryButtonClass = 'px-4 py-2 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50 disabled:opacity-40'

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3">
        <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">快捷转换</h2>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">粘贴订阅链接，一键生成转换链接或短链接</p>

        <input
          type="url"
          value={inputUrl}
          onChange={(event) => {
            setInputUrl(event.target.value)
            setShortUrl('')
          }}
          placeholder="https://example.com/subscription"
          className={inputClass}
        />

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void handleCopyConversion()} disabled={!trimmedUrl} className={buttonClass}>
            复制转换链接
          </button>
          <button onClick={handlePreview} disabled={!trimmedUrl} className={secondaryButtonClass}>
            打开预览
          </button>
          <button onClick={() => void handleGenerateShortLink()} disabled={!trimmedUrl || generating} className={secondaryButtonClass}>
            {generating ? '生成中...' : '生成短链接'}
          </button>
        </div>
      </div>

      {conversionUrl && (
        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">转换链接</h3>
            <button onClick={() => void handleCopyConversion()} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
              复制
            </button>
          </div>
          <p className="font-mono text-[11px] break-all text-gray-600 dark:text-gray-300">{conversionUrl}</p>
        </div>
      )}

      {shortUrl && (
        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-1.5">
          <h3 className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">短链接</h3>
          <p className="font-mono text-sm break-all text-blue-600 dark:text-blue-400">{shortUrl}</p>
        </div>
      )}
    </div>
  )
}
