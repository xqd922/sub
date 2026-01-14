import type { Toast } from '../types'

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  const getColorClass = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-success text-white'
      case 'error':
        return 'bg-danger text-white'
      case 'warning':
        return 'bg-warning text-white'
      case 'info':
        return 'bg-primary text-white'
      default:
        return 'bg-default text-white'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg transition-all animate-in slide-in-from-right ${getColorClass(toast.type)}`}
          onClick={() => toast.id && onClose(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
