'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@cloudflare/kumo/components/badge'
import { RiSettings3Line } from '@remixicon/react'
import { ConversionResultCard } from '@/features/converter/components/conversion-result-card'
import { ShortLinkBar } from '@/features/converter/components/short-link-bar'
import { SubscriptionInputForm } from '@/features/converter/components/subscription-input-form'
import { useShortLinkGenerator } from '@/features/converter/hooks/use-short-link-generator'
import { useSubscriptionConverter } from '@/features/converter/hooks/use-subscription-converter'
import { ThemeIconButton } from '@/features/shared/components/theme-icon-button'
import { useQrCode } from '@/features/shared/hooks/use-qr-code'
import type { TargetClientOverride } from '@/shared/admin.types'
import { cx } from '@/utils/cx'

const PROTOCOL_PREVIEW = [
  'VLESS',
  'VMess',
  'Trojan',
  'Hysteria2',
  'Snell',
  'TUIC',
  'WireGuard',
  'AnyTLS',
  'SS-2022',
] as const

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

  const [showQr, setShowQr] = useState(false)

  const qrTarget = shortUrl || convertedUrl
  const { dataUrl: qrDataUrl } = useQrCode(qrTarget, {
    enabled: showQr && Boolean(qrTarget),
    width: 164,
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

  const handlePreview = () => {
    if (!convertedUrl) return
    const previewUrl = new URL(convertedUrl)
    previewUrl.searchParams.set('target', 'preview')
    window.open(previewUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background-full text-text-primary">
      {/* Subtle technical dot-grid backdrop faded toward outer edges */}
      <div
        aria-hidden
        className="console-dot-grid pointer-events-none fixed inset-0 opacity-65 [mask-image:radial-gradient(ellipse_62%_50%_at_50%_26%,#000_25%,transparent_100%)]"
      />

      <header className="relative z-10 flex h-13 items-center justify-between border-b border-separator-border/80 bg-background-full/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
          />
          <span className="font-mono text-body-2-semibold tracking-tight text-text-primary">
            SubConvert
          </span>
          <Badge variant="outline" className="hidden font-mono sm:inline-flex">
            Edge · 18 协议
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:border-separator-border hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiSettings3Line className="size-3.5" aria-hidden />
            <span>控制台</span>
          </Link>
          <ThemeIconButton />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-5 pt-[15vh] pb-20 sm:px-6 sm:pt-[19vh]">
        <div className="flex w-full max-w-[640px] flex-col">
          <div className="mb-7 text-center">
            <h1 className="text-title-1-semibold tracking-tight text-text-primary">
              通用订阅转换
            </h1>
            <p className="mt-1.5 text-body-2-regular text-text-secondary">
              自动识别客户端 UA，边缘实时输出 Clash、sing-box 与 v2rayNG 配置
            </p>
          </div>

          <SubscriptionInputForm
            value={inputUrl}
            onChange={setInputUrl}
            onSubmit={handleFormSubmit}
            error={error}
            disabled={loading}
            loading={loading}
          />

          {!convertedUrl ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              {PROTOCOL_PREVIEW.map((protocol) => (
                <span
                  key={protocol}
                  className="rounded-md border border-separator-border/80 bg-background-primary-default/75 px-2 py-0.5 font-mono text-caption-2-regular text-text-tertiary"
                >
                  {protocol}
                </span>
              ))}
              <span className="rounded-md border border-separator-border/60 bg-background-secondary-default/70 px-2 py-0.5 font-mono text-caption-2-medium text-text-secondary">
                +9 协议
              </span>
            </div>
          ) : null}

          <div
            className={cx(
              'grid transition-[grid-template-rows,opacity] duration-250 ease-out',
              convertedUrl ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              {convertedUrl ? (
                <div className="mt-5">
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
                  >
                    <ShortLinkBar shortUrl={shortUrl} />

                    {showQr ? (
                      <div className="flex flex-col items-center gap-2 border-t border-separator-border pt-3.5">
                        <div className="inline-flex size-40 items-center justify-center overflow-hidden rounded-xl border border-separator-border bg-background-full p-2 shadow-xs">
                          {qrDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrDataUrl}
                              alt="订阅二维码"
                              className="size-full rounded-md object-contain"
                            />
                          ) : (
                            <span className="font-mono text-caption-2-regular text-text-tertiary">
                              生成中…
                            </span>
                          )}
                        </div>
                        <span className="text-caption-2-regular text-text-tertiary">
                          使用代理客户端扫描二维码导入
                        </span>
                      </div>
                    ) : null}
                  </ConversionResultCard>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
