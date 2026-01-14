import { Button } from '@heroui/react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
  title: string
  message: string
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title,
  message
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p className="text-default-500 mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onPress={onClose}
            isDisabled={loading}
          >
            取消
          </Button>
          <Button
            className="bg-danger text-white hover:bg-danger/90"
            onPress={onConfirm}
            isDisabled={loading}
          >
            {loading ? '删除中...' : '确认删除'}
          </Button>
        </div>
      </div>
    </div>
  )
}
