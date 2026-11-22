'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/base/spinner/spinner'
import { bootstrapAdminCache, useAdminCache } from '@/features/admin/admin.cache'
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
import { useFocusRefresh } from '@/features/shared/hooks/use-focus-refresh'

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
  const cache = useAdminCache()
  const activeTab = useSyncExternalStore(subscribeTabUrl, readTabFromUrl, getServerTab)
  const [focusSearchSignal, setFocusSearchSignal] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const setActiveTab = useCallback((nextTab: AdminTabKey) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (nextTab === 'stats') url.searchParams.delete('tab')
    else url.searchParams.set('tab', nextTab)
    window.history.replaceState(null, '', url.toString())
    for (const listener of tabListeners) listener()
    if (window.innerWidth < 1024 && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [])

  // 切回浏览器标签页时单点静默同步全量控制台快照
  const handleSilentSync = useCallback(() => {
    if (!authenticated) return
    void bootstrapAdminCache({ force: true }).then((status) => {
      if (status === 'unauthorized') resetAuthentication()
    })
  }, [authenticated, resetAuthentication])

  useFocusRefresh(handleSilentSync)

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
        <Spinner size="md" aria-label="加载控制台" />
        <p className="text-body-2-regular">加载控制台…</p>
      </section>
    )
  }

  if (!authenticated) {
    return <AdminLoginView onSubmit={login} />
  }

  const currentTab = ADMIN_TABS.find((tab) => tab.key === activeTab) ?? ADMIN_TABS[0]
  const recordCount = cache.hydrated ? cache.records.length : null
  const shortLinkCount = cache.hydrated ? cache.shortLinks.length : null

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
        <div className="border-b border-separator-border bg-background-primary-default/75 py-3 backdrop-blur-sm sm:py-3.5">
          <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center justify-between gap-2 px-4 sm:px-8">
            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-1.5 text-caption-1-regular text-text-tertiary sm:flex">
                <span>Console</span>
                <span>/</span>
                <span className="text-text-secondary">{currentTab.code}</span>
              </div>
              <div className="flex min-w-0 items-baseline gap-x-3 sm:mt-0.5">
                <h1 className="shrink-0 text-title-3-semibold tracking-[-0.015em] text-text-primary sm:text-title-2-semibold">
                  {currentTab.label}
                </h1>
                <p className="min-w-0 truncate text-body-2-regular text-text-secondary">
                  {currentTab.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-4 py-5 sm:px-8 sm:py-6">
          {activeTab === 'stats' ? <StatsPanel onUnauthorized={resetAuthentication} /> : null}
          {activeTab === 'records' ? (
            <RecordsPanel
              onUnauthorized={resetAuthentication}
              focusSearchSignal={focusSearchSignal}
            />
          ) : null}
          {activeTab === 'shortLinks' ? (
            <ShortLinksPanel onUnauthorized={resetAuthentication} />
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
