import { useCallback, useEffect, useState } from 'react'
import { showToast } from '@/features/shared/hooks/use-toast'

export function useAdminSession() {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let active = true

    const probeSession = async () => {
      try {
        const response = await fetch('/api/admin/session')
        const data = (await response.json()) as { authenticated?: boolean }
        if (active) setAuthenticated(Boolean(data.authenticated))
      } catch {
        if (active) setAuthenticated(false)
      } finally {
        if (active) setChecking(false)
      }
    }

    void probeSession()
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
    setAuthenticated(false)
    showToast('已退出登录', 'info')
  }, [])

  const resetAuthentication = useCallback(() => {
    setAuthenticated(false)
  }, [])

  return { checking, authenticated, login, logout, resetAuthentication }
}
