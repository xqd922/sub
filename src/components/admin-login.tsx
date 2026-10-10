'use client'

import { useState } from 'react'

interface AdminLoginProps {
  onSubmit: (username: string, password: string) => Promise<boolean>
}

export default function AdminLogin({ onSubmit }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password || loading) return

    setLoading(true)
    try {
      await onSubmit(username.trim(), password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="text-center space-y-1 mb-8">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            后台管理
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">请登录以继续</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6"
        >
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="text-xs text-gray-600 dark:text-gray-400">
              用户名
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="未配置则留空"
              autoComplete="username"
              className="w-full px-3 py-2 text-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs text-gray-600 dark:text-gray-400">
              密码
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入管理员密码"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 text-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative w-full py-2.5 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 text-xs sm:text-sm font-medium rounded-lg disabled:opacity-50 transition-all hover:opacity-90 hover:shadow-lg hover:shadow-gray-500/10 overflow-hidden"
          >
            {loading && (
              <div className="absolute inset-0 w-full h-full">
                <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 animate-progress-indeterminate"></div>
              </div>
            )}
            <span className="relative">{loading ? '登录中...' : '登录'}</span>
          </button>
        </form>
      </div>
    </section>
  )
}
