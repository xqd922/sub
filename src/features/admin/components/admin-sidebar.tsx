'use client'

import Link from 'next/link'
import {
  RiArrowLeftLine,
  RiBarChartBoxLine,
  RiFileList3Line,
  RiLinkM,
  RiLinksLine,
  RiLogoutBoxRLine,
  RiSearchLine,
  RiShieldCheckLine,
  RiToolsLine,
} from '@remixicon/react'
import { Kbd } from '@/components/base/kbd/kbd'
import { ThemeIconButton } from '@/features/shared/components/theme-icon-button'
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
    description: '创建、编辑目标地址、扫码分享与管理短链跳转',
    icon: RiLinkM,
  },
  {
    key: 'tools',
    label: '快捷工具',
    description: '检测订阅健康度、组装指定客户端链接与生成短链',
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
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[228px] lg:shrink-0 lg:flex-col lg:border-e lg:border-separator-border lg:bg-background-secondary-default/45 lg:px-3 lg:py-4"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-background-secondary-hover/65 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-separator-border bg-background-primary-default text-text-primary">
            <RiLinksLine className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate text-body-2-semibold text-text-primary">通用订阅转换</div>
            <div className="truncate text-caption-2-regular text-text-tertiary">管理后台</div>
          </div>
        </Link>

        <button
          type="button"
          onClick={onQuickSearch}
          className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-separator-border bg-background-primary-default/80 px-2.5 py-1.5 text-caption-1-regular text-text-tertiary transition-colors duration-150 hover:border-border-button-hover hover:text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="inline-flex items-center gap-2">
            <RiSearchLine className="size-3.5 shrink-0" aria-hidden />
            <span>快速搜索</span>
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <nav className="mt-4 flex flex-1 flex-col gap-0.5">
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
                  'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-body-2-medium transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  active
                    ? 'bg-background-primary-default text-text-primary shadow-2xs ring-1 ring-separator-border'
                    : 'text-text-secondary hover:bg-background-secondary-hover/65 hover:text-text-primary',
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon
                    className={cx(
                      'size-4 shrink-0',
                      active ? 'text-text-primary' : 'text-foreground-icon-tertiary',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{tab.label}</span>
                </span>
                {count !== null ? (
                  <span
                    className={cx(
                      'font-mono text-caption-2-medium tabular-nums',
                      active ? 'text-text-secondary' : 'text-text-tertiary',
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="mt-3 flex items-center justify-between gap-1 border-t border-separator-border pt-3">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-caption-1-medium text-text-tertiary transition-colors duration-150 hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden />
            <span>首页</span>
          </Link>

          <div className="flex items-center gap-0.5">
            <ThemeIconButton className="hover:bg-background-primary-default" />
            <button
              type="button"
              onClick={onLogout}
              aria-label="退出登录"
              title="退出登录"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiLogoutBoxRLine className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex flex-col border-b border-separator-border bg-background-full/95 backdrop-blur-md lg:hidden">
        <div className="flex h-13 items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 text-body-2-semibold text-text-primary"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-separator-border bg-background-secondary-default text-text-primary">
              <RiLinksLine className="size-3.5" aria-hidden />
            </span>
            <span className="truncate">通用订阅转换</span>
            <span className="text-caption-1-regular text-text-tertiary">/</span>
            <span className="truncate text-caption-1-medium text-text-secondary">管理</span>
          </Link>

          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              href="/"
              aria-label="返回首页"
              title="返回首页"
              className="inline-flex size-8 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary"
            >
              <RiArrowLeftLine className="size-4" aria-hidden />
            </Link>
            <ThemeIconButton />
            <button
              type="button"
              onClick={onLogout}
              aria-label="退出登录"
              title="退出登录"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-tertiary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary"
            >
              <RiLogoutBoxRLine className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-caption-1-medium whitespace-nowrap transition-colors duration-150',
                  active
                    ? 'bg-background-secondary-default text-text-primary ring-1 ring-separator-border'
                    : 'text-text-tertiary hover:bg-background-secondary-default/60 hover:text-text-primary',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{tab.label}</span>
                {count !== null ? (
                  <span className="font-mono text-caption-2-medium tabular-nums text-text-tertiary">
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </header>
    </>
  )
}
