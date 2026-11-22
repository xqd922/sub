'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RiMoonLine, RiSunLine } from '@remixicon/react'
import { useUrlConverter } from '@/components/use-convert'
import { useShortUrl } from '@/components/use-short-link'
import { applyThemeWithTransition, useThemeMode } from '@/components/application/theme/theme-toggle'
import { cx } from '@/utils/cx'
import UrlInput from './url-input'
import ResultItem from './copy-button'
import ShortUrlGenerator from './short-link'
import HomeScene from './home-scene'

function formatHangzhouTime(): string {
  try {
    return new Date().toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

export default function HomeContent() {
  const {
    inputUrl,
    setInputUrl,
    loading,
    error,
    convertedUrl,
    handleConvert,
    handleCopy,
  } = useUrlConverter()

  const {
    shortUrl,
    shortenLoading,
    generateShortUrl,
    setShortUrl,
  } = useShortUrl()

  const theme = useThemeMode()
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [pulseKey, setPulseKey] = useState(0)
  const [clock, setClock] = useState('')

  useEffect(() => {
    const sync = () => setClock(formatHangzhouTime())
    sync()
    const timer = window.setInterval(sync, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showQr || !convertedUrl) return
    let cancelled = false
    const target = shortUrl || convertedUrl

    const renderQr = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(target, { width: 160, margin: 1 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      }
    }

    void renderQr()
    return () => {
      cancelled = true
    }
  }, [showQr, convertedUrl, shortUrl])

  const triggerConvert = async (overrideUrl?: string) => {
    setShortUrl('')
    setShowQr(false)
    setQrDataUrl(null)
    const result = await handleConvert(overrideUrl)
    if (result) {
      setPulseKey((k) => k + 1)
    }
  }

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void triggerConvert()
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
    window.open(convertedUrl, '_blank', 'noopener,noreferrer')
  }

  const navLinkClass =
    'cursor-pointer text-body-2-regular text-text-secondary transition-colors duration-150 hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-xs'

  return (
    <div className="min-h-screen bg-background-full px-5 pb-14 pt-6 text-text-primary sm:px-6 sm:pt-8">
      <div className="mx-auto flex w-full max-w-[520px] flex-col">
        {/* 居中静谧文字导航 —— 同步 blog.xqd.pp.ua */}
        <header className="mb-12 flex items-center justify-center gap-6 sm:mb-16">
          <Link href="/" className="text-body-2-medium text-text-primary">
            转换
          </Link>
          <Link href="/admin" className={navLinkClass}>
            后台
          </Link>
          <a
            href="https://blog.xqd.pp.ua"
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            博客
          </a>
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
            title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            {theme === 'dark' ? (
              <RiSunLine className="size-3.5" aria-hidden />
            ) : (
              <RiMoonLine className="size-3.5" aria-hidden />
            )}
          </button>
        </header>

        <main className="flex flex-col">
          {/* 标题与一句话说明 */}
          <div className="mb-6">
            <h1 className="text-[22px] leading-7 font-medium tracking-[-0.55px] text-text-primary">
              通用订阅转换
            </h1>
            <p className="mt-1.5 text-body-regular leading-[22px] text-text-secondary">
              把链接贴进来，剩下的交给它自动识别。
            </p>
          </div>

          {/* 留言板同款无框柔灰输入区 */}
          <form onSubmit={handleFormSubmit} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start">
            <UrlInput
              value={inputUrl}
              onChange={(val) => {
                setInputUrl(val)
              }}
              error={error}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="h-10 shrink-0 cursor-pointer rounded-lg border-0 bg-text-primary px-4 text-body-2-medium text-background-full transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2"
            >
              {loading ? '转换中…' : '转换'}
            </button>
          </form>

          {/* 博客同款克制说明行 */}
          <p className="mb-6 text-body-2-regular leading-[23px] text-text-secondary">
            自动识别{' '}
            <span className="text-text-primary underline decoration-text-primary/25 decoration-1 underline-offset-4">
              Clash / sing-box / v2rayNG
            </span>
            ，同时支持{' '}
            <span className="text-text-primary underline decoration-text-primary/25 decoration-1 underline-offset-4">
              Gist 节点集
            </span>{' '}
            与{' '}
            <span className="text-text-primary underline decoration-text-primary/25 decoration-1 underline-offset-4">
              单节点 URI
            </span>
            。
          </p>

          {/* 转换结果折叠展开区 */}
          <div
            className={cx(
              'grid transition-[grid-template-rows,opacity] duration-250 ease-out',
              convertedUrl ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              {convertedUrl ? (
                <div className="flex flex-col gap-3 pb-6">
                  <ResultItem
                    url={convertedUrl}
                    onCopy={() => handleCopy(convertedUrl)}
                    onGenerateShort={() => void generateShortUrl(convertedUrl)}
                    shortLoading={shortenLoading}
                    hasShortUrl={Boolean(shortUrl)}
                    showQr={showQr}
                    onToggleQr={() => setShowQr((prev) => !prev)}
                    onPreview={handlePreview}
                  />

                  <ShortUrlGenerator
                    shortUrl={shortUrl}
                    onCopy={() => handleCopy(shortUrl)}
                  />

                  {showQr ? (
                    <div className="flex items-center gap-3.5 rounded-lg bg-background-secondary-default p-3">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1.5">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={qrDataUrl} alt="订阅链接二维码" className="size-full object-contain" />
                        ) : (
                          <span className="text-caption-2-regular text-neutral-400">生成中…</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 text-caption-1-regular text-text-secondary">
                        <span className="text-body-2-medium text-text-primary">
                          {shortUrl ? '扫码导入（短链接）' : '扫码导入'}
                        </span>
                        <span>用客户端扫一下即可，不需要手动粘贴长链接。</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* 与 blog.xqd.pp.ua 呼应的湖畔路由线稿 */}
          <div className="mt-2 mb-6">
            <HomeScene
              pulseKey={pulseKey}
              onInteract={() => setPulseKey((k) => k + 1)}
            />
          </div>

          {/* 静谧底部时间签 */}
          <footer className="flex items-center justify-between text-caption-1-regular tabular-nums text-text-tertiary">
            <span className="inline-flex items-center gap-2">
              <span>{clock ? `${clock}，杭州` : '杭州'}</span>
              <svg
                width="16"
                height="14"
                viewBox="0 0 20 18"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
                aria-hidden
              >
                <path d="M7 7 C6.2 2.5 8 1.5 8.8 5.5" />
                <path d="M13 7 C13.8 2.5 12 1.5 11.2 5.5" />
                <path d="M5 11.5 C5 8.5 7.2 7 10 7 C12.8 7 15 8.5 15 11.5 C15 13.5 13.4 15 10 15 C6.6 15 5 13.5 5 11.5 Z" />
                <circle cx="8.2" cy="11" r="0.6" fill="currentColor" />
                <circle cx="11.8" cy="11" r="0.6" fill="currentColor" />
              </svg>
            </span>
            <span>sub.xqd.pp.ua</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
