'use client'

import { useState } from 'react'
import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinksLine,
  RiQrCodeLine,
} from '@remixicon/react'
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

  const actionClass =
    'inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring'

  return (
    <div className="flex flex-col gap-3">
      <div
        dir="ltr"
        className="select-all font-mono text-caption-1-regular leading-relaxed break-all text-text-primary"
      >
        {url}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void handleCopyClick()}
          className={cx(
            actionClass,
            copied && 'border-separator-border bg-background-primary-default text-status-lime-text',
          )}
        >
          {copied ? <RiCheckLine className="size-3.5" aria-hidden /> : <RiFileCopyLine className="size-3.5" aria-hidden />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>

        {onGenerateShort ? (
          <button
            type="button"
            disabled={shortLoading}
            onClick={onGenerateShort}
            className={actionClass}
          >
            <RiLinksLine className="size-3.5" aria-hidden />
            <span>{shortLoading ? '生成中…' : hasShortUrl ? '重生成' : '短链'}</span>
          </button>
        ) : null}

        {onToggleQr ? (
          <button
            type="button"
            onClick={onToggleQr}
            aria-pressed={showQr}
            className={cx(
              actionClass,
              showQr && 'border-separator-border bg-background-primary-default text-text-primary',
            )}
          >
            <RiQrCodeLine className="size-3.5" aria-hidden />
            <span>二维码</span>
          </button>
        ) : null}

        {onPreview ? (
          <button type="button" onClick={onPreview} className={actionClass}>
            <RiExternalLinkLine className="size-3.5" aria-hidden />
            <span>预览</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
