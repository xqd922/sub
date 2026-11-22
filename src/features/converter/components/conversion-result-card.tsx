'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { ClipboardText } from '@cloudflare/kumo/components/clipboard-text'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import {
  RiCheckLine,
  RiDownload2Line,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinksLine,
  RiQrCodeLine,
} from '@remixicon/react'
import type { TargetClientOverride } from '@/shared/admin.types'
import { cx } from '@/utils/cx'

interface ConversionResultCardProps {
  url: string
  target: TargetClientOverride
  onChangeTarget: (target: TargetClientOverride) => void
  onCopy: () => Promise<boolean> | void
  onGenerateShort?: () => void
  shortLoading?: boolean
  hasShortUrl?: boolean
  showQr?: boolean
  onToggleQr?: () => void
  onPreview?: () => void
  children?: React.ReactNode
}

const TARGET_TABS: Array<{ value: TargetClientOverride; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'clash', label: 'Clash' },
  { value: 'singbox', label: 'sing-box' },
  { value: 'v2rayng', label: 'v2rayNG' },
]

const ACTION_BUTTON_CLASS =
  'inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-md border border-separator-border bg-background-primary-default px-2.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-border-button-hover hover:bg-background-secondary-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring'

export function ConversionResultCard({
  url,
  target,
  onChangeTarget,
  onCopy,
  onGenerateShort,
  shortLoading = false,
  hasShortUrl = false,
  showQr = false,
  onToggleQr,
  onPreview,
  children,
}: ConversionResultCardProps) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const handleCopyClick = async () => {
    const result = await onCopy()
    if (result !== false) {
      setCopied(true)
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const clashImportHref = `clash://install-config?url=${encodeURIComponent(url)}`
  const singboxImportHref = `sing-box://import-remote-profile?url=${encodeURIComponent(url)}`

  return (
    <LayerCard className="w-full overflow-hidden">
      <LayerCard.Secondary className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5">
        <Tabs
          variant="segmented"
          size="sm"
          tabs={TARGET_TABS}
          value={target}
          onValueChange={(value) => onChangeTarget(value as TargetClientOverride)}
        />
        <Badge variant="success" appearance="dot">
          已就绪
        </Badge>
      </LayerCard.Secondary>

      <LayerCard.Primary className="flex flex-col gap-3.5 p-3.5">
        <div dir="ltr" className="w-full">
          <ClipboardText
            text={url}
            size="sm"
            className="w-full"
            tooltip={{ text: '复制订阅地址', copiedText: '已复制' }}
            labels={{ copyAction: '复制订阅地址' }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopyClick()}
              className={cx(
                ACTION_BUTTON_CLASS,
                copied && 'border-status-lime-text/30 bg-status-lime-background/50 text-status-lime-text',
              )}
            >
              {copied ? (
                <RiCheckLine className="size-3.5" aria-hidden />
              ) : (
                <RiFileCopyLine className="size-3.5" aria-hidden />
              )}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            {onGenerateShort ? (
              <button
                type="button"
                disabled={shortLoading}
                onClick={onGenerateShort}
                className={ACTION_BUTTON_CLASS}
              >
                <RiLinksLine className="size-3.5" aria-hidden />
                <span>{shortLoading ? '生成中…' : hasShortUrl ? '重生成短链' : '生成短链'}</span>
              </button>
            ) : null}

            {onToggleQr ? (
              <button
                type="button"
                onClick={onToggleQr}
                aria-pressed={showQr}
                className={cx(
                  ACTION_BUTTON_CLASS,
                  showQr && 'border-accent-500/40 bg-accent-500/10 text-text-primary',
                )}
              >
                <RiQrCodeLine className="size-3.5" aria-hidden />
                <span>二维码</span>
              </button>
            ) : null}

            {onPreview ? (
              <button type="button" onClick={onPreview} className={ACTION_BUTTON_CLASS}>
                <RiExternalLinkLine className="size-3.5" aria-hidden />
                <span>预览配置</span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {target === 'auto' || target === 'clash' ? (
              <a href={clashImportHref} className={ACTION_BUTTON_CLASS}>
                <RiDownload2Line className="size-3.5" aria-hidden />
                <span>导入 Clash</span>
              </a>
            ) : null}

            {target === 'auto' || target === 'singbox' ? (
              <a href={singboxImportHref} className={ACTION_BUTTON_CLASS}>
                <RiDownload2Line className="size-3.5" aria-hidden />
                <span>导入 sing-box</span>
              </a>
            ) : null}
          </div>
        </div>

        {children}
      </LayerCard.Primary>
    </LayerCard>
  )
}
