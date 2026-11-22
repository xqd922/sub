'use client'

import { Badge } from '@cloudflare/kumo/components/badge'
import { ClipboardText } from '@cloudflare/kumo/components/clipboard-text'

interface ShortLinkBarProps {
  shortUrl: string
  onCopy?: () => Promise<boolean> | void
}

export function ShortLinkBar({ shortUrl }: ShortLinkBarProps) {
  if (!shortUrl) return null

  return (
    <div className="flex flex-col gap-2 border-t border-separator-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption-1-medium text-text-secondary">短链地址</span>
        <Badge variant="info" appearance="filled">
          /s/
        </Badge>
      </div>
      <div dir="ltr" className="w-full">
        <ClipboardText
          text={shortUrl}
          size="sm"
          className="w-full"
          tooltip={{ text: '复制短链', copiedText: '已复制' }}
          labels={{ copyAction: '复制短链' }}
        />
      </div>
    </div>
  )
}
