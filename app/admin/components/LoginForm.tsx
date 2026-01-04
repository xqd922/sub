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
        locked?: boolean
        remainingTime?: number
      }

      if (!res.ok || !data.success) {
        let errorMsg = data.error || '登录失败'
        if (data.attemptsLeft !== undefined && data.attemptsLeft > 0) {
          errorMsg += `（剩余 ${data.attemptsLeft} 次尝试）`
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">
            订阅管理
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            登录以管理你的订阅转换服务
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                用户名
              </label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#27272a] rounded-lg
                           text-white placeholder-gray-600
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                           outline-none transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                密码
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#27272a] rounded-lg
                           text-white placeholder-gray-600
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                           outline-none transition-all duration-200"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!username || !password || loading}
            className="w-full mt-6 py-3 px-4 bg-white text-black rounded-lg font-medium
                       hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>登录中...</span>
              </>
            ) : (
              <span>登录</span>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Powered by Sub Converter
        </p>
      </div>
    </div>
  )
}
