'use client'

import { useState } from 'react'
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react'
import { cx } from '@/utils/cx'

interface ShortUrlGeneratorProps {
  shortUrl: string
  onCopy: () => Promise<boolean> | void
}

export default function ShortUrlGenerator({ shortUrl, onCopy }: ShortUrlGeneratorProps) {
  const [copied, setCopied] = useState(false)

  if (!shortUrl) return null

  const handleCopy = async () => {
    const result = await onCopy()
    if (result !== false) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-separator-border pt-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-caption-2-medium text-text-tertiary">短链</span>
        <span
          dir="ltr"
          className="min-w-0 flex-1 select-all truncate font-mono text-caption-1-regular text-text-primary"
        >
          {shortUrl}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={cx(
          'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-transparent px-2 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          copied && 'text-status-lime-text',
        )}
      >
        {copied ? <RiCheckLine className="size-3.5" aria-hidden /> : <RiFileCopyLine className="size-3.5" aria-hidden />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
    </div>
  )
}
