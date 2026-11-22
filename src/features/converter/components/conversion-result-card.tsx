'use client'

import { useEffect, useRef, useState } from 'react'
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
}

const TARGET_OPTIONS: ReadonlyArray<{ id: TargetClientOverride; label: string }> = [
  { id: 'auto', label: '自动识别' },
  { id: 'clash', label: 'Clash' },
  { id: 'singbox', label: 'sing-box' },
  { id: 'v2rayng', label: 'v2rayNG' },
]

const ACTION_BUTTON_CLASS =
  'inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring'

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="输出格式">
        {TARGET_OPTIONS.map((option) => {
          const active = target === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChangeTarget(option.id)}
              aria-pressed={active}
              className={cx(
                'h-6.5 cursor-pointer rounded-md px-2 text-caption-2-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                active
                  ? 'bg-background-primary-default text-text-primary shadow-2xs ring-1 ring-separator-border'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

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
            ACTION_BUTTON_CLASS,
            copied && 'border-separator-border bg-background-primary-default text-status-lime-text',
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
            <span>{shortLoading ? '生成中…' : hasShortUrl ? '重生成' : '短链'}</span>
          </button>
        ) : null}

        {onToggleQr ? (
          <button
            type="button"
            onClick={onToggleQr}
            aria-pressed={showQr}
            className={cx(
              ACTION_BUTTON_CLASS,
              showQr && 'border-separator-border bg-background-primary-default text-text-primary',
            )}
          >
            <RiQrCodeLine className="size-3.5" aria-hidden />
            <span>二维码</span>
          </button>
        ) : null}

        {onPreview ? (
          <button type="button" onClick={onPreview} className={ACTION_BUTTON_CLASS}>
            <RiExternalLinkLine className="size-3.5" aria-hidden />
            <span>预览</span>
          </button>
        ) : null}

        {target === 'auto' || target === 'clash' ? (
          <a href={clashImportHref} className={ACTION_BUTTON_CLASS}>
            <RiDownload2Line className="size-3.5" aria-hidden />
            <span>导入 Clash</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}
