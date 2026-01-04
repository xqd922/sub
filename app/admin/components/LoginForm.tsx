'use client'

import { useState } from 'react'

interface LoginFormProps {
  onLogin: (token: string) => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json() as {
        success?: boolean
        token?: string
        error?: string
        attemptsLeft?: number
      }

      if (!res.ok || !data.success) {
        let errorMsg = data.error || '登录失败'
        if (data.attemptsLeft !== undefined && data.attemptsLeft > 0) {
          errorMsg += `（剩余 ${data.attemptsLeft} 次）`
        }
        setError(errorMsg)
        return
      }

      localStorage.setItem('admin_token', data.token || '')
      onLogin(data.token || '')
    } catch {
      setError('登录请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium text-neutral-800 dark:text-neutral-100">
            订阅管理
          </h1>
        </div>

        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
          {error && (
            <div className="text-red-500 text-sm mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900
                           border border-neutral-200 dark:border-neutral-700 rounded
                           text-neutral-800 dark:text-neutral-100
                           focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500
                           text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900
                           border border-neutral-200 dark:border-neutral-700 rounded
                           text-neutral-800 dark:text-neutral-100
                           focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500
                           text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!username || !password || loading}
            className="w-full mt-6 py-2 bg-neutral-800 dark:bg-neutral-100
                       text-white dark:text-neutral-900 rounded text-sm font-medium
                       hover:bg-neutral-700 dark:hover:bg-neutral-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
