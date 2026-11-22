'use client'

import { useEffect, useState } from 'react'
import { RiFileCopyLine, RiQrCodeLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { Spinner } from '@/components/base/spinner/spinner'
import { showToast } from '@/components/use-toast'
import { useClipboard } from '@/components/use-clipboard'

interface QrCodeModalProps {
  url: string
  title: string
  onClose: () => void
}

export default function QrCodeModal({ url, title, onClose }: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { copyToClipboard } = useClipboard()

  useEffect(() => {
    let cancelled = false

    const generate = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const generated = await QRCode.toDataURL(url, { width: 256, margin: 2 })
        if (!cancelled) setDataUrl(generated)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void generate()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <Modal isOpen onOpenChange={(open) => { if (!open) onClose() }} size="sm">
      <ModalHeader
        title={title}
        description="使用代理客户端扫码即可直接导入"
        icon={RiQrCodeLine}
        closeLabel="关闭"
      />
      <ModalBody>
        <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-separator-border bg-background-secondary-default p-5">
          {failed ? (
            <p className="text-body-2-regular text-text-error-primary">二维码生成失败</p>
          ) : dataUrl ? (
            <div className="rounded-xl bg-white p-2.5 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt={`${title} 的二维码`} className="size-48 rounded-md" />
            </div>
          ) : (
            <Spinner size="md" aria-label="生成二维码中" />
          )}
          <p dir="ltr" className="max-w-full truncate font-mono text-caption-1-regular text-text-tertiary">
            {url}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
        <Button
          variant="primary"
          leadingIcon={RiFileCopyLine}
          onClick={async () => {
            const copied = await copyToClipboard(url)
            showToast(copied ? '链接已复制' : '复制失败', copied ? 'success' : 'error')
          }}
        >
          复制链接
        </Button>
      </ModalFooter>
    </Modal>
  )
}
