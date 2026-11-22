'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RiMoonLine, RiSettings3Line, RiSunLine } from '@remixicon/react'
import {
  applyThemeWithTransition,
  useThemeMode,
} from '@/components/application/theme/theme-toggle'
import { ConversionResultCard } from '@/features/converter/components/conversion-result-card'
import { ShortLinkBar } from '@/features/converter/components/short-link-bar'
import { SubscriptionInputForm } from '@/features/converter/components/subscription-input-form'
import { useShortLinkGenerator } from '@/features/converter/hooks/use-short-link-generator'
import { useSubscriptionConverter } from '@/features/converter/hooks/use-subscription-converter'
import { useQrCode } from '@/features/shared/hooks/use-qr-code'
import type { TargetClientOverride } from '@/shared/admin.types'
import { cx } from '@/utils/cx'

export function ConverterPage() {
  const {
    inputUrl,
    setInputUrl,
    target,
    changeTarget,
    loading,
    error,
    convertedUrl,
    convert,
    copyText,
  } = useSubscriptionConverter()
  const { shortUrl, loading: shortenLoading, generate, reset: resetShortUrl } =
    useShortLinkGenerator()

  const theme = useThemeMode()
  const [showQr, setShowQr] = useState(false)

  const qrTarget = shortUrl || convertedUrl
  const { dataUrl: qrDataUrl } = useQrCode(qrTarget, {
    enabled: showQr && Boolean(qrTarget),
    width: 148,
    margin: 2,
  })

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    resetShortUrl()
    setShowQr(false)
    void convert()
  }

  const handleChangeTarget = (nextTarget: TargetClientOverride) => {
    resetShortUrl()
    changeTarget(nextTarget)
  }

  const handleToggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const origin =
      event.clientX === 0 && event.clientY === 0
        ? null
        : { x: event.clientX, y: event.clientY }
    void applyThemeWithTransition(theme === 'dark' ? 'light' : 'dark', {
      origin,
      element: event.currentTarget,
    })
  }

  const handlePreview = () => {
    if (!convertedUrl) return
    const previewUrl = new URL(convertedUrl)
    previewUrl.searchParams.set('target', 'preview')
    window.open(previewUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full text-text-primary">
      <header className="flex items-center justify-end gap-1 px-5 pt-4 sm:px-6 sm:pt-5">
        <Link
          href="/admin"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-caption-1-medium text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiSettings3Line className="size-3.5" aria-hidden />
          <span>管理</span>
        </Link>
        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          {theme === 'dark' ? (
            <RiSunLine className="size-4" aria-hidden />
          ) : (
            <RiMoonLine className="size-4" aria-hidden />
          )}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 pt-[18vh] pb-16 sm:px-6 sm:pt-[22vh]">
        <div className="flex w-full max-w-[560px] flex-col">
          <h1 className="mb-7 text-center text-title-1-medium tracking-tight text-text-primary">
            通用订阅转换
          </h1>

          <SubscriptionInputForm
            value={inputUrl}
            onChange={setInputUrl}
            onSubmit={handleFormSubmit}
            error={error}
            disabled={loading}
            loading={loading}
          />

          <div
            className={cx(
              'grid transition-[grid-template-rows,opacity] duration-250 ease-out',
              convertedUrl ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              {convertedUrl ? (
                <div className="mt-4 rounded-xl border border-separator-border bg-background-secondary-default/70 p-3.5">
                  <ConversionResultCard
                    url={convertedUrl}
                    target={target}
                    onChangeTarget={handleChangeTarget}
                    onCopy={() => copyText(convertedUrl)}
                    onGenerateShort={() => void generate(convertedUrl)}
                    shortLoading={shortenLoading}
                    hasShortUrl={Boolean(shortUrl)}
                    showQr={showQr}
                    onToggleQr={() => setShowQr((prev) => !prev)}
                    onPreview={handlePreview}
                  />

                  <ShortLinkBar shortUrl={shortUrl} onCopy={() => copyText(shortUrl)} />

                  {showQr ? (
                    <div className="mt-3 flex justify-center border-t border-separator-border pt-3">
                      <div className="inline-flex size-36 items-center justify-center overflow-hidden rounded-lg border border-separator-border bg-background-primary-default p-2">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrDataUrl}
                            alt="订阅二维码"
                            className="size-full rounded-sm object-contain"
                          />
                        ) : (
                          <span className="text-caption-2-regular text-text-tertiary">…</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
