'use client'

import { useEffect, useState } from 'react'
import { showToast } from '@/components/use-toast'
import { useClipboard } from '@/components/use-clipboard'

interface QrCodeModalProps {
  url: string
  title: string
  onClose: () => void
}

export default function QrCodeModal({ url, title, onClose }: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { copyToClipboard } = useClipboard()

  useEffect(() => {
    let cancelled = false

    const generate = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const generated = await QRCode.toDataURL(url, { width: 256, margin: 2 })
        if (!cancelled) setDataUrl(generated)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void generate()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelled = true
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [url, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 max-w-xs w-full space-y-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={title}>{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="flex items-center justify-center min-h-64">
          {failed ? (
            <p className="text-xs text-red-500">二维码生成失败</p>
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`${title} 的二维码`} className="rounded-lg" />
          ) : (
            <p className="text-xs text-gray-400">生成中...</p>
          )}
        </div>

        <button
          onClick={async () => {
            const copied = await copyToClipboard(url)
            showToast(copied ? '链接已复制' : '复制失败', copied ? 'success' : 'error')
          }}
          className="w-full py-1.5 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50"
        >
          复制链接
        </button>
      </div>
    </div>
  )
}
