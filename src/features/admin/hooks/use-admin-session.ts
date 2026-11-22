import { useCallback, useEffect, useState } from 'react'
import {
  bootstrapAdminCache,
  clearAdminCache,
  hydrateAdminCacheFromStorage,
} from '@/features/admin/admin.cache'
import { showToast } from '@/features/shared/hooks/use-toast'

export function useAdminSession() {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let active = true

    const init = async () => {
      // 有有效会话缓存时首帧即刻展示控制台，后台静默校验并刷新
      const hasWarmCache = hydrateAdminCacheFromStorage()
      if (hasWarmCache && active) {
        setAuthenticated(true)
        setChecking(false)
      }

      const status = await bootstrapAdminCache({ force: true })
      if (!active) return

      if (status === 'ok') {
        setAuthenticated(true)
      } else if (status === 'unauthorized') {
        setAuthenticated(false)
      } else if (!hasWarmCache) {
        // 首次冷启动遇到网络异常，回退探测 session 状态决定是否展示登录页
        try {
          const response = await fetch('/api/admin/session')
          const data = (await response.json()) as { authenticated?: boolean }
          if (active) setAuthenticated(Boolean(data.authenticated))
        } catch {
          if (active) setAuthenticated(false)
        }
      }

      if (active) setChecking(false)
    }

    void init()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string }
      } | null

      if (!response.ok) {
        showToast(data?.error?.message || '登录失败', 'error')
        return false
      }

      setAuthenticated(true)
      void bootstrapAdminCache({ force: true })
      showToast('登录成功', 'success')
      return true
    } catch {
      showToast('登录请求失败，请稍后重试', 'error')
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // 忽略登出请求失败，本地状态照常清除
    }
    clearAdminCache()
    setAuthenticated(false)
    showToast('已退出登录', 'info')
  }, [])

  const resetAuthentication = useCallback(() => {
    clearAdminCache()
    setAuthenticated(false)
  }, [])

  return { checking, authenticated, login, logout, resetAuthentication }
}
