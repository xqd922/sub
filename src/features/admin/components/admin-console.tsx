'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Spinner } from '@/components/base/spinner/spinner'
import { AdminLoginView } from '@/features/admin/components/admin-login-view'
import {
  ADMIN_TABS,
  AdminSidebar,
  type AdminTabKey,
} from '@/features/admin/components/admin-sidebar'
import { RecordsPanel } from '@/features/admin/components/records-panel'
import { RulesPanel } from '@/features/admin/components/rules-panel'
import { ShortLinksPanel } from '@/features/admin/components/short-links-panel'
import { StatsPanel } from '@/features/admin/components/stats-panel'
import { useAdminSession } from '@/features/admin/hooks/use-admin-session'

const VALID_TABS = new Set<AdminTabKey>(['stats', 'records', 'shortLinks', 'config'])
const tabListeners = new Set<() => void>()

function readTabFromUrl(): AdminTabKey {
  if (typeof window === 'undefined') return 'stats'
  const param = new URLSearchParams(window.location.search).get('tab') as AdminTabKey | null
  return param && VALID_TABS.has(param) ? param : 'stats'
}

function getServerTab(): AdminTabKey {
  return 'stats'
}

function subscribeTabUrl(onStoreChange: () => void): () => void {
  tabListeners.add(onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  return () => {
    tabListeners.delete(onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
  }
}

export function AdminConsole() {
  const { checking, authenticated, login, logout, resetAuthentication } = useAdminSession()
  const activeTab = useSyncExternalStore(subscribeTabUrl, readTabFromUrl, getServerTab)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [shortLinkCount, setShortLinkCount] = useState<number | null>(null)
  const [focusSearchSignal, setFocusSearchSignal] = useState(0)

  const setActiveTab = useCallback((nextTab: AdminTabKey) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (nextTab === 'stats') url.searchParams.delete('tab')
    else url.searchParams.set('tab', nextTab)
    window.history.replaceState(null, '', url.toString())
    for (const listener of tabListeners) listener()
  }, [])

  // Cmd/Ctrl + K 快捷跳转到订阅搜索框
  useEffect(() => {
    if (!authenticated) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setActiveTab('records')
        setFocusSearchSignal((count) => count + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authenticated, setActiveTab])

  const handleStatsCountsLoaded = useCallback((recordsTotal: number, shortLinksTotal: number) => {
    setRecordCount(recordsTotal)
    setShortLinkCount(shortLinksTotal)
  }, [])

  if (checking) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-full text-text-tertiary">
        <Spinner size="md" aria-label="检查登录状态" />
        <p className="text-body-2-regular">检查登录状态…</p>
      </section>
    )
  }

  if (!authenticated) {
    return <AdminLoginView onSubmit={login} />
  }

  const currentTab = ADMIN_TABS.find((tab) => tab.key === activeTab) ?? ADMIN_TABS[0]

  const jumpToSearch = () => {
    setActiveTab('records')
    setFocusSearchSignal((count) => count + 1)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full text-text-primary lg:flex-row">
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickSearch={jumpToSearch}
        onLogout={() => void logout()}
        recordCount={recordCount}
        shortLinkCount={shortLinkCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-separator-border px-5 py-4 sm:px-8">
          <div className="mx-auto w-full max-w-[1060px]">
            <h1 className="text-headline-semibold tracking-tight text-text-primary">
              {currentTab.label}
            </h1>
            <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
              {currentTab.description}
            </p>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-[1060px] flex-1 flex-col px-5 py-6 sm:px-8">
          {activeTab === 'stats' ? (
            <StatsPanel
              onUnauthorized={resetAuthentication}
              onCountsLoaded={handleStatsCountsLoaded}
            />
          ) : null}
          {activeTab === 'records' ? (
            <RecordsPanel
              onUnauthorized={resetAuthentication}
              onCountChange={setRecordCount}
              focusSearchSignal={focusSearchSignal}
            />
          ) : null}
          {activeTab === 'shortLinks' ? (
            <ShortLinksPanel
              onUnauthorized={resetAuthentication}
              onCountChange={setShortLinkCount}
            />
          ) : null}
          {activeTab === 'config' ? <RulesPanel onUnauthorized={resetAuthentication} /> : null}
        </main>
      </div>
    </div>
  )
}
