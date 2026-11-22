'use client'

import { RiFileCopyLine, RiQrCodeLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { Spinner } from '@/components/base/spinner/spinner'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { useQrCode } from '@/features/shared/hooks/use-qr-code'
import { showToast } from '@/features/shared/hooks/use-toast'

interface QrCodeModalProps {
  url: string
  title: string
  onClose: () => void
}

export function QrCodeModal({ url, title, onClose }: QrCodeModalProps) {
  const { dataUrl, failed } = useQrCode(url, { width: 256, margin: 3 })
  const { copyToClipboard } = useClipboard()

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="sm"
    >
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
            <div className="overflow-hidden rounded-xl border border-separator-border bg-background-primary-default p-1.5 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt={`${title} 的二维码`} className="size-48 rounded-lg" />
            </div>
          ) : (
            <Spinner size="md" aria-label="生成二维码中" />
          )}
          <p
            dir="ltr"
            className="max-w-full truncate font-mono text-caption-1-regular text-text-tertiary"
          >
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
