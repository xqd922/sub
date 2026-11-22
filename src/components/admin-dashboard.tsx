'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  RiArrowLeftLine,
  RiBarChartBoxLine,
  RiFileList3Line,
  RiLinkM,
  RiLogoutBoxRLine,
  RiSearchLine,
  RiShieldCheckLine,
  RiToolsLine,
} from '@remixicon/react'
import { ThemeToggle } from '@/components/application/theme/theme-toggle'
import { Counter } from '@/components/base/badges/counter'
import { StatusDot } from '@/components/base/badges/status-dot'
import { Breadcrumb, BreadcrumbItem } from '@/components/base/breadcrumb/breadcrumb'
import { Button } from '@/components/base/buttons/button'
import { Divider } from '@/components/base/divider/divider'
import { Kbd } from '@/components/base/kbd/kbd'
import { Spinner } from '@/components/base/spinner/spinner'
import { Switch } from '@/components/base/switch/switch'
import { useAdminSession } from '@/components/use-admin-session'
import { cx } from '@/utils/cx'
import AdminLogin from './admin-login'
import AdminStats from './admin-stats'
import AdminRecords from './admin-records'
import AdminShortLinks from './admin-short-links'
import AdminTools from './admin-tools'
import AdminSystem from './admin-system'

type TabKey = 'stats' | 'records' | 'shortLinks' | 'tools' | 'system'

const TABS: Array<{
  key: TabKey
  label: string
  description: string
  icon: typeof RiBarChartBoxLine
}> = [
  { key: 'stats', label: '概览统计', description: '实时转换趋势、客户端占比与热门订阅', icon: RiBarChartBoxLine },
  { key: 'records', label: '转换记录', description: '管理订阅启停状态、节点命中与备注信息', icon: RiFileList3Line },
  { key: 'shortLinks', label: '短链接', description: '创建、重命名、扫码分享与管理短链跳转', icon: RiLinkM },
  { key: 'tools', label: '快捷工具', description: '粘贴订阅地址，一键生成转换链接与短链', icon: RiToolsLine },
  { key: 'system', label: '系统运维', description: '环境配置状态检查、KV 存储维护与登录审计', icon: RiShieldCheckLine },
]

export default function AdminDashboard() {
  const { checking, authenticated, login, logout, resetAuthentication } = useAdminSession()
  const [activeTab, setActiveTab] = useState<TabKey>('stats')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [shortLinkCount, setShortLinkCount] = useState<number | null>(null)
  const [focusSearchSignal, setFocusSearchSignal] = useState(0)

  // Cmd/Ctrl + K 快捷跳转到转换记录搜索框
  useEffect(() => {
    if (!authenticated) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setActiveTab('records')
        setFocusSearchSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authenticated])

  if (checking) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-secondary-default text-text-secondary">
        <Spinner size="md" aria-label="检查登录状态" />
        <p className="text-body-2-regular">检查登录状态…</p>
      </section>
    )
  }

  if (!authenticated) {
    return <AdminLogin onSubmit={login} />
  }

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0]

  const getTabCount = (key: TabKey): number | null => {
    if (key === 'records') return recordCount
    if (key === 'shortLinks') return shortLinkCount
    return null
  }

  const jumpToSearch = () => {
    setActiveTab('records')
    setFocusSearchSignal((n) => n + 1)
  }

  return (
    <div className="min-h-screen bg-background-secondary-default text-text-primary">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 p-3 sm:p-5 lg:flex-row lg:items-start lg:gap-5">
        {/* BoardUI Detached Floating Sidebar (Desktop) */}
        <aside
          aria-label="后台导航"
          className="hidden lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:w-[248px] lg:shrink-0 lg:flex-col lg:rounded-3xl lg:border lg:border-border-button-default lg:bg-background-primary-default lg:p-3.5 lg:shadow-sidebar"
        >
          {/* Workspace Brand */}
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-button-primary font-mono text-caption-1-bold text-text-white shadow-xs">
              S/
            </div>
            <div className="min-w-0">
              <div className="truncate text-body-semibold text-text-primary">Sub Console</div>
              <div className="truncate text-caption-2-regular text-text-tertiary">订阅转换控制台</div>
            </div>
          </div>

          {/* Quick Search Trigger (⌘K) */}
          <button
            type="button"
            onClick={jumpToSearch}
            className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-xl border border-separator-border bg-background-secondary-default px-2.5 py-2 text-body-2-regular text-text-tertiary transition-colors duration-150 hover:border-border-button-hover hover:text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span className="inline-flex items-center gap-2">
              <RiSearchLine className="size-4 shrink-0" aria-hidden />
              <span>快速搜索</span>
            </span>
            <Kbd>⌘K</Kbd>
          </button>

          {/* Navigation Items */}
          <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              const count = getTabCount(tab.key)
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex w-full cursor-pointer items-center justify-between gap-2 rounded-2lg px-2.5 py-2 text-body-medium transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    active
                      ? 'bg-button-primary text-text-white shadow-nav-selected'
                      : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={cx(
                        'size-[18px] shrink-0',
                        active ? 'text-text-white' : 'text-foreground-icon-secondary',
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {count !== null ? (
                    <Counter color={active ? 'primary' : 'neutral'}>{count}</Counter>
                  ) : null}
                </button>
              )
            })}
          </nav>

          {/* Pinned Sidebar Footer */}
          <div className="mt-3 flex flex-col gap-2.5 pt-2">
            <Divider />

            <div className="flex items-center justify-between px-1.5">
              <span className="inline-flex items-center gap-2 text-caption-1-medium text-text-secondary">
                <StatusDot color="green" />
                Cloudflare Edge
              </span>
              <ThemeToggle appearance="sidebar-segmented" size="small" />
            </div>

            <div className="flex items-center gap-1.5">
              <Link
                href="/"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-button-default bg-background-primary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:bg-background-primary-hover hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <RiArrowLeftLine className="size-3.5" aria-hidden />
                首页
              </Link>
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiLogoutBoxRLine}
                onClick={() => void logout()}
                className="flex-1 text-caption-1-medium"
              >
                退出
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile / Tablet Navigation Card */}
        <header className="flex flex-col gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-3.5 shadow-card lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-button-primary font-mono text-caption-1-bold text-text-white shadow-xs">
                S/
              </div>
              <div>
                <div className="text-body-semibold text-text-primary">Sub Console</div>
                <div className="text-caption-2-regular text-text-tertiary">订阅转换控制台</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle appearance="segmented" size="small" />
              <Link
                href="/"
                aria-label="返回首页"
                className="inline-flex size-8 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default text-foreground-icon-secondary hover:bg-background-primary-hover hover:text-foreground-icon-primary"
              >
                <RiArrowLeftLine className="size-4" aria-hidden />
              </Link>
              <Button variant="secondary" size="small" onClick={() => void logout()}>
                退出
              </Button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              const count = getTabCount(tab.key)
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cx(
                    'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-body-2-medium whitespace-nowrap transition-colors duration-150',
                    active
                      ? 'bg-button-primary text-text-white shadow-nav-selected'
                      : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{tab.label}</span>
                  {count !== null ? (
                    <Counter color={active ? 'primary' : 'neutral'}>{count}</Counter>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Main Workspace */}
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

            <div className="flex items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default px-3.5 py-2 shadow-xs">
              <Switch
                size="sm"
                isSelected={autoRefresh}
                onChange={setAutoRefresh}
              >
                <span className="text-body-2-medium text-text-secondary">自动刷新（30s）</span>
              </Switch>
            </div>
          </div>

          <main className="min-w-0">
            {activeTab === 'stats' ? <AdminStats autoRefresh={autoRefresh} /> : null}
            {activeTab === 'records' ? (
              <AdminRecords
                autoRefresh={autoRefresh}
                onUnauthorized={resetAuthentication}
                onCountChange={setRecordCount}
                focusSearchSignal={focusSearchSignal}
              />
            ) : null}
            {activeTab === 'shortLinks' ? (
              <AdminShortLinks
                autoRefresh={autoRefresh}
                onUnauthorized={resetAuthentication}
                onCountChange={setShortLinkCount}
              />
            ) : null}
            {activeTab === 'tools' ? <AdminTools /> : null}
            {activeTab === 'system' ? (
              <AdminSystem autoRefresh={autoRefresh} onUnauthorized={resetAuthentication} />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}
