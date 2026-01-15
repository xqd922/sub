import type { Toast } from '../types'

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

const SuccessIcon = () => (
  <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const ErrorIcon = () => (
  <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const WarningIcon = () => (
  <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const InfoIcon = () => (
  <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return <SuccessIcon />
      case 'error': return <ErrorIcon />
      case 'warning': return <WarningIcon />
      case 'info': return <InfoIcon />
      default: return <InfoIcon />
    }
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {getIcon(toast.type)}
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => toast.id && onClose(toast.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}
