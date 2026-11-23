'use client'

import { usePathname } from 'next/navigation'
import { Toaster } from '@/components/base/toast/toast'

export function AppToaster() {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  return (
    <Toaster
      position="bottom-end"
      duration={3200}
      limit={3}
      aria-label="系统通知"
      closeLabel="关闭通知"
      className={
        isAdmin ? 'max-lg:bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]' : undefined
      }
    />
  )
}
