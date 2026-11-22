'use client'

import { useState } from 'react'
import { cx } from '@/utils/cx'

interface ResultItemProps {
  url: string
  onCopy: () => Promise<boolean> | void
  onGenerateShort?: () => void
  shortLoading?: boolean
  hasShortUrl?: boolean
  showQr?: boolean
  onToggleQr?: () => void
  onPreview?: () => void
}

export default function ResultItem({
  url,
  onCopy,
  onGenerateShort,
  shortLoading = false,
  hasShortUrl = false,
  showQr = false,
  onToggleQr,
  onPreview,
}: ResultItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyClick = async () => {
    const result = await onCopy()
    if (result !== false) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const linkClass =
    'cursor-pointer border-0 bg-transparent p-0 text-body-2-regular text-text-primary underline decoration-text-primary/30 decoration-1 underline-offset-4 transition-colors duration-150 hover:decoration-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-xs'

  return (
    <div className="flex flex-col gap-2.5">
      <div
        dir="ltr"
        className="rounded-lg bg-background-secondary-default px-3.5 py-3 font-mono text-caption-1-regular leading-relaxed break-all text-text-primary"
      >
        {url}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-body-2-regular text-text-secondary">
        <span>已生成，可直接导入客户端</span>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => void handleCopyClick()}
            className={cx(linkClass, copied && 'text-status-lime-text decoration-status-lime-text/50')}
          >
            {copied ? '已复制' : '复制'}
          </button>
          {onGenerateShort ? (
            <button
              type="button"
              disabled={shortLoading}
              onClick={onGenerateShort}
              className={cx(linkClass, 'disabled:cursor-not-allowed disabled:opacity-50')}
            >
              {shortLoading ? '生成中…' : hasShortUrl ? '重新生成短链' : '短链接'}
            </button>
          ) : null}
          {onToggleQr ? (
            <button type="button" onClick={onToggleQr} className={linkClass}>
              {showQr ? '收起二维码' : '二维码'}
            </button>
          ) : null}
          {onPreview ? (
            <button type="button" onClick={onPreview} className={linkClass}>
              预览
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
