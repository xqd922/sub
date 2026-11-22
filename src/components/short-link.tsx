'use client'

import { useState } from 'react'
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
    <div className="flex justify-end">
      <div className="inline-flex max-w-full items-center gap-3 rounded-lg bg-background-secondary-default px-3 py-2 text-body-2-regular text-text-primary">
        <span dir="ltr" className="truncate font-mono text-caption-1-regular">
          {shortUrl}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={cx(
            'shrink-0 cursor-pointer border-0 bg-transparent p-0 text-caption-1-medium text-text-primary underline decoration-text-primary/35 decoration-1 underline-offset-4 transition-colors duration-150 hover:decoration-text-primary',
            copied && 'text-status-lime-text decoration-status-lime-text/50',
          )}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    </div>
  )
}
