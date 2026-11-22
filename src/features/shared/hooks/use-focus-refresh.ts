import { useEffect, useRef } from 'react'

/** 切回当前浏览器标签页或窗口重新获得焦点时静默同步数据，带冷却防抖避免频繁读取 */
export function useFocusRefresh(callback: () => void, cooldownMs = 15_000): void {
  const lastSyncRef = useRef(0)

  useEffect(() => {
    lastSyncRef.current = Date.now()

    const trigger = () => {
      if (document.hidden) return
      const now = Date.now()
      if (now - lastSyncRef.current < cooldownMs) return
      lastSyncRef.current = now
      callback()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') trigger()
    }

    window.addEventListener('focus', trigger)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', trigger)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [callback, cooldownMs])
}
