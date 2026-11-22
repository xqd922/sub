'use client'

import { useState } from 'react'
import {
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinkM,
  RiLinksLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { useClipboard } from '@/components/use-clipboard'
import { showToast } from '@/components/use-toast'
import QrCodeModal from './qr-code'

export default function AdminTools() {
  const [inputUrl, setInputUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [qrTarget, setQrTarget] = useState<{ url: string; title: string } | null>(null)
  const { copyToClipboard } = useClipboard()

  const trimmedUrl = inputUrl.trim()
  const conversionUrl =
    trimmedUrl && typeof window !== 'undefined'
      ? `${window.location.origin}/sub?url=${encodeURIComponent(trimmedUrl)}`
      : ''

  const handleCopyConversion = async () => {
    if (!conversionUrl) return
    const copied = await copyToClipboard(conversionUrl)
    showToast(copied ? '转换链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handleCopyShort = async () => {
    if (!shortUrl) return
    const copied = await copyToClipboard(shortUrl)
    showToast(copied ? '短链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handlePreview = () => {
    if (!trimmedUrl) return
    window.open(`/sub?url=${encodeURIComponent(trimmedUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const handleGenerateShortLink = async () => {
    if (!conversionUrl || generating) return

    setGenerating(true)
    setShortUrl('')
    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: conversionUrl }),
      })

      if (!response.ok) {
        throw new Error('短链接生成服务暂时不可用')
      }

      const data = (await response.json()) as { shortUrl?: string }
      if (data.shortUrl) {
        setShortUrl(data.shortUrl)
        const copied = await copyToClipboard(data.shortUrl)
        showToast(copied ? '短链接已生成并复制' : '短链接已生成', 'success')
      } else {
        throw new Error('未获取到短链接')
      }
    } catch (error) {
      showToast((error as Error).message || '生成失败', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
        <div className="mb-4">
          <h2 className="text-headline-medium text-text-primary">快捷转换与短链工具</h2>
          <p className="mt-1 text-body-2-regular text-text-secondary">
            粘贴原始订阅链接，快速组装转换地址、打开浏览器预览或生成短链。
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="原始订阅地址"
            type="url"
            inputDir="ltr"
            leadingIcon={RiLinksLine}
            value={inputUrl}
            onChange={(value) => {
              setInputUrl(value)
              setShortUrl('')
            }}
            placeholder="https://example.com/subscription"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="small"
              leadingIcon={RiFileCopyLine}
              disabled={!trimmedUrl}
              onClick={() => void handleCopyConversion()}
            >
              复制转换链接
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={RiExternalLinkLine}
              disabled={!trimmedUrl}
              onClick={handlePreview}
            >
              配置预览
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={RiLinkM}
              disabled={!trimmedUrl || generating}
              onClick={() => void handleGenerateShortLink()}
            >
              {generating ? '生成中…' : '生成短链接'}
            </Button>
            {conversionUrl ? (
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiQrCodeLine}
                onClick={() =>
                  setQrTarget({
                    url: shortUrl || conversionUrl,
                    title: shortUrl ? '短链接二维码' : '转换链接二维码',
                  })
                }
              >
                二维码
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {conversionUrl ? (
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-caption-1-semibold text-text-secondary">转换链接</h3>
            <Button variant="ghost" size="xs" leadingIcon={RiFileCopyLine} onClick={() => void handleCopyConversion()}>
              复制
            </Button>
          </div>
          <div
            dir="ltr"
            className="rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 font-mono text-caption-1-regular break-all text-text-primary"
          >
            {conversionUrl}
          </div>
        </div>
      ) : null}

      {shortUrl ? (
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-caption-1-semibold text-text-secondary">短链接</h3>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                leadingIcon={RiQrCodeLine}
                onClick={() => setQrTarget({ url: shortUrl, title: '短链接二维码' })}
              >
                二维码
              </Button>
              <Button variant="ghost" size="xs" leadingIcon={RiFileCopyLine} onClick={() => void handleCopyShort()}>
                复制
              </Button>
            </div>
          </div>
          <div
            dir="ltr"
            className="rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 font-mono text-body-2-medium break-all text-accent-600 dark:text-accent-400"
          >
            {shortUrl}
          </div>
        </div>
      ) : null}

      {qrTarget ? (
        <QrCodeModal url={qrTarget.url} title={qrTarget.title} onClose={() => setQrTarget(null)} />
      ) : null}
    </div>
  )
}
