'use client'

import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'

interface RenameEntityModalProps {
  isOpen: boolean
  title: string
  description: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

export function RenameEntityModal({
  isOpen,
  title,
  description,
  label,
  placeholder,
  value,
  onChange,
  onClose,
  onConfirm,
}: RenameEntityModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="sm"
    >
      <ModalHeader title={title} description={description} closeLabel="关闭" />
      <ModalBody>
        <Input
          label={label}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onConfirm()
            }
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" disabled={!value.trim()} onClick={() => void onConfirm()}>
          保存修改
        </Button>
      </ModalFooter>
    </Modal>
  )
}
