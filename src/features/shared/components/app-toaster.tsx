'use client'

import { Toaster } from '@/components/base/toast/toast'

export function AppToaster() {
  return (
    <Toaster
      position="bottom-end"
      duration={3200}
      limit={3}
      aria-label="系统通知"
      closeLabel="关闭通知"
    />
  )
}
