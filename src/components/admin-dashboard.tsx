'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAdminSession } from '@/components/use-admin-session'
import AdminLogin from './admin-login'
import AdminStats from './admin-stats'
import AdminRecords from './admin-records'
import AdminShortLinks from './admin-short-links'
import AdminTools from './admin-tools'
import AdminSystem from './admin-system'

type TabKey = 'stats' | 'records' | 'shortLinks' | 'tools' | 'system'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'stats', label: '概览统计' },
  { key: 'records', label: '转换记录' },
  { key: 'shortLinks', label: '短链接' },
  { key: 'tools', label: '快捷工具' },
  { key: 'system', label: '系统运维' }
]

export default function AdminDashboard() {
  const { checking, authenticated, login, logout, resetAuthentication } = useAdminSession()
  const [activeTab, setActiveTab] = useState<TabKey>('stats')
  const [autoRefresh, setAutoRefresh] = useState(false)

  if (checking) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-center justify-center">
        <p className="text-xs text-gray-400">检查登录状态...</p>
      </section>
    )
  }

  if (!authenticated) {
    return <AdminLogin onSubmit={login} />
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-light tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              后台管理
            </h1>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">订阅转换管理面板</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">自动刷新（30 秒）</span>
            </label>
            <button
              onClick={() => void logout()}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50"
            >
              退出登录
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5 p-1 rounded-xl bg-white/40 dark:bg-black/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 w-fit max-w-full overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 shadow'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <main>
          {activeTab === 'stats' && <AdminStats autoRefresh={autoRefresh} />}
          {activeTab === 'records' && <AdminRecords autoRefresh={autoRefresh} onUnauthorized={resetAuthentication} />}
          {activeTab === 'shortLinks' && <AdminShortLinks autoRefresh={autoRefresh} onUnauthorized={resetAuthentication} />}
          {activeTab === 'tools' && <AdminTools />}
          {activeTab === 'system' && <AdminSystem autoRefresh={autoRefresh} onUnauthorized={resetAuthentication} />}
        </main>

        <footer className="mt-8 text-center">
          <Link href="/" className="text-[10px] text-gray-400 hover:text-blue-500 dark:hover:text-blue-400">← 返回首页</Link>
        </footer>
      </div>
    </section>
  )
}
