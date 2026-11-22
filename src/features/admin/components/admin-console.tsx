'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/base/spinner/spinner'
import { AdminCommandPalette } from '@/features/admin/components/admin-command-palette'
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
  const router = useRouter()
  const { checking, authenticated, login, logout, resetAuthentication } = useAdminSession()
  const activeTab = useSyncExternalStore(subscribeTabUrl, readTabFromUrl, getServerTab)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [shortLinkCount, setShortLinkCount] = useState<number | null>(null)
  const [focusSearchSignal, setFocusSearchSignal] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const setActiveTab = useCallback((nextTab: AdminTabKey) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (nextTab === 'stats') url.searchParams.delete('tab')
    else url.searchParams.set('tab', nextTab)
    window.history.replaceState(null, '', url.toString())
    for (const listener of tabListeners) listener()
  }, [])

  // Cmd/Ctrl + K 打开 Kumo 命令面板
  useEffect(() => {
    if (!authenticated) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authenticated])

  const handleStatsCountsLoaded = useCallback((recordsTotal: number, shortLinksTotal: number) => {
    setRecordCount(recordsTotal)
    setShortLinkCount(shortLinksTotal)
  }, [])

  const handleFocusRecordSearch = useCallback(() => {
    setActiveTab('records')
    setFocusSearchSignal((count) => count + 1)
  }, [setActiveTab])

  const handleGoHome = useCallback(() => {
    router.push('/')
  }, [router])

  if (checking) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-full text-text-tertiary">
        <Spinner size="md" aria-label="检查登录状态" />
        <p className="font-mono text-caption-1-regular">验证管理会话…</p>
      </section>
    )
  }

  if (!authenticated) {
    return <AdminLoginView onSubmit={login} />
  }

  const currentTab = ADMIN_TABS.find((tab) => tab.key === activeTab) ?? ADMIN_TABS[0]

  return (
    <div className="flex min-h-screen flex-col bg-background-full text-text-primary lg:flex-row">
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onLogout={() => void logout()}
        recordCount={recordCount}
        shortLinkCount={shortLinkCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-separator-border bg-background-primary-default/75 px-5 py-3.5 backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-caption-2-regular text-text-tertiary">
                <span>Console</span>
                <span>/</span>
                <span className="text-text-secondary">{currentTab.code}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h1 className="text-title-3-semibold tracking-tight text-text-primary">
                  {currentTab.label}
                </h1>
                <p className="text-caption-1-regular text-text-tertiary">
                  {currentTab.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-5 py-6 sm:px-8">
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

      <AdminCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectTab={setActiveTab}
        onFocusRecordSearch={handleFocusRecordSearch}
        onGoHome={handleGoHome}
        onLogout={() => void logout()}
      />
    </div>
  )
}
