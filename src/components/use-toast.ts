import { useCallback } from 'react'
import { toast } from '@/components/base/toast/toast'

type ToastType = 'success' | 'error' | 'info'

export function showToast(message: string, type: ToastType = 'success') {
  if (type === 'error') {
    toast.error(message)
  } else if (type === 'info') {
    toast.info(message)
  } else {
    toast.success(message)
  }
}

export function useToast() {
  const trigger = useCallback((message: string, type: ToastType = 'success') => {
    showToast(message, type)
  }, [])

  return { showToast: trigger }
}
