import { useEffect } from 'react'

export function useAutoRefresh(callback: () => void, enabled: boolean, intervalMs = 30_000): void {
  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      if (!document.hidden) callback()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [callback, enabled, intervalMs])
}
