import { AlertDialog, Button } from '@heroui/react'

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
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Backdrop variant="blur" />
      <AlertDialog.Container placement="center">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <AlertDialog.CloseTrigger isDisabled={loading}>
              取消
            </AlertDialog.CloseTrigger>
            <Button variant="danger" onPress={onConfirm} isDisabled={loading}>
              {loading ? '删除中...' : '确认删除'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog>
  )
}
