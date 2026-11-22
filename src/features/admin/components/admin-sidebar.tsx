'use client'

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
import { Button } from '@/components/base/buttons/button'
import { Divider } from '@/components/base/divider/divider'
import { Kbd } from '@/components/base/kbd/kbd'
import { cx } from '@/utils/cx'

export type AdminTabKey = 'stats' | 'records' | 'shortLinks' | 'tools' | 'system'

export interface AdminTabMeta {
  key: AdminTabKey
  label: string
  description: string
  icon: typeof RiBarChartBoxLine
}

export const ADMIN_TABS: readonly AdminTabMeta[] = [
  {
    key: 'stats',
    label: '概览统计',
    description: '实时转换趋势、客户端占比与热门订阅',
    icon: RiBarChartBoxLine,
  },
  {
    key: 'records',
    label: '转换记录',
    description: '管理订阅启停状态、节点命中与备注信息',
    icon: RiFileList3Line,
  },
  {
    key: 'shortLinks',
    label: '短链接',
    description: '创建、重命名、扫码分享与管理短链跳转',
    icon: RiLinkM,
  },
  {
    key: 'tools',
    label: '快捷工具',
    description: '粘贴订阅地址，一键生成转换链接与短链',
    icon: RiToolsLine,
  },
  {
    key: 'system',
    label: '系统运维',
    description: '环境配置状态检查、KV 存储维护与登录审计',
    icon: RiShieldCheckLine,
  },
]

interface AdminSidebarProps {
  activeTab: AdminTabKey
  onSelectTab: (tab: AdminTabKey) => void
  onQuickSearch: () => void
  onLogout: () => void
  recordCount: number | null
  shortLinkCount: number | null
}

function getTabBadgeCount(
  key: AdminTabKey,
  recordCount: number | null,
  shortLinkCount: number | null,
): number | null {
  if (key === 'records') return recordCount
  if (key === 'shortLinks') return shortLinkCount
  return null
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  onQuickSearch,
  onLogout,
  recordCount,
  shortLinkCount,
}: AdminSidebarProps) {
  return (
    <>
      <aside
        aria-label="后台导航"
        className="hidden lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)] lg:w-[248px] lg:shrink-0 lg:flex-col lg:rounded-3xl lg:border lg:border-border-button-default lg:bg-background-primary-default lg:p-3.5 lg:shadow-sidebar"
      >
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-button-primary font-mono text-caption-1-bold text-text-white shadow-xs">
            S/
          </div>
          <div className="min-w-0">
            <div className="truncate text-body-semibold text-text-primary">Sub Console</div>
            <div className="truncate text-caption-2-regular text-text-tertiary">订阅转换控制台</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onQuickSearch}
          className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-xl border border-separator-border bg-background-secondary-default px-2.5 py-2 text-body-2-regular text-text-tertiary transition-colors duration-150 hover:border-border-button-hover hover:text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="inline-flex items-center gap-2">
            <RiSearchLine className="size-4 shrink-0" aria-hidden />
            <span>快速搜索</span>
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            const count = getTabBadgeCount(tab.key, recordCount, shortLinkCount)
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
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
              onClick={onLogout}
              className="flex-1 text-caption-1-medium"
            >
              退出
            </Button>
          </div>
        </div>
      </aside>

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
            <Button variant="secondary" size="small" onClick={onLogout}>
              退出
            </Button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            const count = getTabBadgeCount(tab.key, recordCount, shortLinkCount)
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
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
    </>
  )
}
