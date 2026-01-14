import { useState, useCallback } from 'react'
import type { Toast } from '../types'

interface UseToastReturn {
  toasts: Toast[]
  showToast: (type: Toast['type'], message: string) => void
  hideToast: (id: string) => void
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { type, message, id }

    setToasts(prev => [...prev, newToast])

    // 3秒后自动移除
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    toasts,
    showToast,
    hideToast
  }
}
