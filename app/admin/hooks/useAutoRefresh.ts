import { useEffect } from 'react'

interface UseAutoRefreshOptions {
  enabled: boolean
  active: boolean
  intervalMs?: number
  onRefresh: () => void | Promise<void>
}

export function useAutoRefresh({
  enabled,
  active,
  intervalMs = 30000,
  onRefresh
}: UseAutoRefreshOptions) {
  useEffect(() => {
    if (!enabled || !active) return

    const timer = setInterval(() => {
      void onRefresh()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [active, enabled, intervalMs, onRefresh])
}
