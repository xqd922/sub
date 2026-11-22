'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { RiRefreshLine } from '@remixicon/react'
import { Breadcrumb, BreadcrumbItem } from '@/components/base/breadcrumb/breadcrumb'
import { Button } from '@/components/base/buttons/button'
import { Spinner } from '@/components/base/spinner/spinner'
import { Switch } from '@/components/base/switch/switch'
import { AdminLoginView } from '@/features/admin/components/admin-login-view'
import {
  ADMIN_TABS,
  AdminSidebar,
  type AdminTabKey,
} from '@/features/admin/components/admin-sidebar'
import { RecordsPanel } from '@/features/admin/components/records-panel'
import { ShortLinksPanel } from '@/features/admin/components/short-links-panel'
import { StatsPanel } from '@/features/admin/components/stats-panel'
import { SystemPanel } from '@/features/admin/components/system-panel'
import { ToolsPanel } from '@/features/admin/components/tools-panel'
import { useAdminSession } from '@/features/admin/hooks/use-admin-session'

const VALID_TABS = new Set<AdminTabKey>(['stats', 'records', 'shortLinks', 'tools', 'system'])
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
  const { checking, authenticated, expiresAt, login, logout, resetAuthentication } =
    useAdminSession()
  const activeTab = useSyncExternalStore(subscribeTabUrl, readTabFromUrl, getServerTab)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [shortLinkCount, setShortLinkCount] = useState<number | null>(null)
  const [focusSearchSignal, setFocusSearchSignal] = useState(0)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const setActiveTab = useCallback((nextTab: AdminTabKey) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (nextTab === 'stats') url.searchParams.delete('tab')
    else url.searchParams.set('tab', nextTab)
    window.history.replaceState(null, '', url.toString())
    for (const listener of tabListeners) listener()
  }, [])

  // Cmd/Ctrl + K 快捷跳转到转换记录搜索框
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
      <section className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-secondary-default text-text-secondary">
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
    <div className="min-h-screen bg-background-secondary-default text-text-primary">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 p-3 sm:p-5 lg:flex-row lg:items-start lg:gap-5">
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onQuickSearch={jumpToSearch}
          onLogout={() => void logout()}
          recordCount={recordCount}
          shortLinkCount={shortLinkCount}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
            <div className="flex min-w-0 flex-col gap-1">
              <Breadcrumb>
                <BreadcrumbItem onClick={() => setActiveTab('stats')}>Sub Console</BreadcrumbItem>
                <BreadcrumbItem current>{currentTab.label}</BreadcrumbItem>
              </Breadcrumb>
              <h1 className="text-title-2-medium text-text-primary">{currentTab.label}</h1>
              <p className="text-body-2-regular text-text-secondary">{currentTab.description}</p>
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'tools' ? (
                <Button
                  variant="secondary"
                  size="small"
                  leadingIcon={RiRefreshLine}
                  onClick={() => setRefreshSignal((count) => count + 1)}
                >
                  刷新
                </Button>
              ) : null}

              <div className="flex items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default px-3.5 py-2 shadow-xs">
                <Switch size="sm" isSelected={autoRefresh} onChange={setAutoRefresh}>
                  <span className="text-body-2-medium text-text-secondary">自动刷新（30s）</span>
                </Switch>
              </div>
            </div>
          </div>

          <main className="min-w-0">
            {activeTab === 'stats' ? (
              <StatsPanel
                autoRefresh={autoRefresh}
                refreshSignal={refreshSignal}
                onUnauthorized={resetAuthentication}
                onCountsLoaded={handleStatsCountsLoaded}
              />
            ) : null}
            {activeTab === 'records' ? (
              <RecordsPanel
                autoRefresh={autoRefresh}
                refreshSignal={refreshSignal}
                onUnauthorized={resetAuthentication}
                onCountChange={setRecordCount}
                focusSearchSignal={focusSearchSignal}
              />
            ) : null}
            {activeTab === 'shortLinks' ? (
              <ShortLinksPanel
                autoRefresh={autoRefresh}
                refreshSignal={refreshSignal}
                onUnauthorized={resetAuthentication}
                onCountChange={setShortLinkCount}
              />
            ) : null}
            {activeTab === 'tools' ? <ToolsPanel onUnauthorized={resetAuthentication} /> : null}
            {activeTab === 'system' ? (
              <SystemPanel
                autoRefresh={autoRefresh}
                refreshSignal={refreshSignal}
                sessionExpiresAt={expiresAt}
                onUnauthorized={resetAuthentication}
              />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}
