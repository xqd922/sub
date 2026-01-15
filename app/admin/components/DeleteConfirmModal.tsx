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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button
            className="modal-btn cancel"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            className="modal-btn confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}
