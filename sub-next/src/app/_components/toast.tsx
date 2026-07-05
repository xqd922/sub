'use client'

import { useToast } from '../_hooks/use_toast'

const typeClasses: Record<string, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800',
}

export default function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-2 rounded-lg shadow-lg animate-fade-up text-white ${typeClasses[toast.type] ?? typeClasses.info}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
