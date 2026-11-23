'use client'

import Link from 'next/link'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import {
  RiArrowLeftLine,
  RiBarChartBoxLine,
  RiEqualizerLine,
  RiFileList3Line,
  RiHome5Line,
  RiLinkM,
  RiLogoutBoxRLine,
  RiSearchLine,
} from '@remixicon/react'
import { Kbd } from '@/components/base/kbd/kbd'
import { ThemeIconButton } from '@/features/shared/components/theme-icon-button'
import { cx } from '@/utils/cx'

export type AdminTabKey = 'stats' | 'records' | 'shortLinks' | 'config'

export interface AdminTabMeta {
  key: AdminTabKey
  label: string
  mobileTitle: string
  code: string
  description: string
  icon: typeof RiBarChartBoxLine
}

export const ADMIN_TABS: readonly AdminTabMeta[] = [
  {
    key: 'stats',
    label: '概览',
    mobileTitle: '控制台概览',
    code: 'Overview',
    description: '实时转换趋势、客户端占比与活跃热力图',
    icon: RiBarChartBoxLine,
  },
  {
    key: 'records',
    label: '订阅',
    mobileTitle: '订阅管理',
    code: 'Subscriptions',
    description: '管理订阅启停、在线节点检测与元数据详情',
    icon: RiFileList3Line,
  },
  {
    key: 'shortLinks',
    label: '短链',
    mobileTitle: '短链管理',
    code: 'Short Links',
    description: '自定义短码、输出格式、访问密钥与导入导出',
    icon: RiLinkM,
  },
  {
    key: 'config',
    label: '配置',
    mobileTitle: '配置中心',
    code: 'Routing & UA',
    description: '动态分流规则与客户端 UA 适配，保存即刻生效',
    icon: RiEqualizerLine,
  },
]

interface AdminSidebarProps {
  activeTab: AdminTabKey
  onSelectTab: (tab: AdminTabKey) => void
  onOpenCommandPalette: () => void
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
  onOpenCommandPalette,
  onLogout,
  recordCount,
  shortLinkCount,
}: AdminSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        aria-label="后台导航"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[236px] lg:shrink-0 lg:flex-col lg:border-e lg:border-separator-border lg:bg-background-secondary-default lg:px-3 lg:py-3.5"
      >
        <Link
          href="/"
          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-background-secondary-hover outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
            />
            <span className="truncate text-body-semibold tracking-[-0.015em] text-text-primary">
              SubConvert
            </span>
          </span>
          <span className="rounded border border-separator-border bg-background-primary-default px-1.5 py-0.5 text-caption-2-medium tracking-wider text-text-tertiary">
            EDGE
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="mt-3 flex h-8.5 w-full cursor-pointer items-center justify-between rounded-lg border border-separator-border bg-background-primary-default px-2.5 text-body-2-regular text-text-tertiary shadow-2xs transition-colors duration-150 hover:border-border-button-hover hover:text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="inline-flex items-center gap-2">
            <RiSearchLine className="size-3.5 shrink-0" aria-hidden />
            <span>命令面板…</span>
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <div className="mt-5 px-2 text-caption-2-medium tracking-wider text-text-tertiary uppercase">
          Workspace
        </div>

        <nav className="mt-1.5 flex flex-1 flex-col gap-0.5">
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
                  'relative flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 transition-[background-color,color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  active
                    ? 'border-separator-border bg-background-primary-default text-body-medium text-text-primary shadow-2xs'
                    : 'border-transparent text-body-regular text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute start-0 top-2 bottom-2 w-0.5 rounded-full bg-accent-500"
                  />
                ) : null}
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon
                    className={cx(
                      'size-4 shrink-0',
                      active ? 'text-accent-500' : 'text-foreground-icon-tertiary',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{tab.label}</span>
                </span>
                {count !== null ? (
                  <span
                    className={cx(
                      'rounded-md px-1.5 py-0.5 text-caption-1-medium tabular-nums',
                      active
                        ? 'bg-background-secondary-default text-text-primary'
                        : 'text-text-tertiary',
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
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-body-2-regular text-text-secondary transition-colors duration-150 hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden />
            <span>转换首页</span>
          </Link>

          <div className="flex items-center gap-0.5">
            <ThemeIconButton className="hover:bg-background-primary-default" />
            <Tooltip
              content="退出登录"
              side="top"
              render={
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="退出登录"
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background-primary-default hover:text-text-error-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  <RiLogoutBoxRLine className="size-4" aria-hidden />
                </button>
              }
            />
          </div>
        </div>
      </aside>

      {/* Mobile Single-Row Sticky App Bar */}
      <header className="sticky top-0 z-30 flex transform-gpu items-center justify-between gap-2 border-b border-separator-border bg-background-primary-default/92 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
        <div className="flex h-13 min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
          />
          <h1 className="truncate text-headline-semibold tracking-[-0.015em] text-text-primary">
            {(ADMIN_TABS.find((tab) => tab.key === activeTab) ?? ADMIN_TABS[0]).mobileTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/"
            aria-label="返回转换首页"
            className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 active:bg-background-secondary-default outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiHome5Line className="size-[18px]" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="快捷导航与搜索"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 active:bg-background-secondary-default outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiSearchLine className="size-[18px]" aria-hidden />
          </button>
          <ThemeIconButton disableTooltip className="size-9" />
          <button
            type="button"
            onClick={onLogout}
            aria-label="退出登录"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 active:bg-background-secondary-default active:text-text-error-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiLogoutBoxRLine className="size-[18px]" aria-hidden />
          </button>
        </div>
      </header>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="控制台分页"
        className="fixed inset-x-0 bottom-0 z-30 transform-gpu border-t border-separator-border bg-background-primary-default/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid h-15 max-w-[560px] grid-cols-4 px-1.5">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            const count = getTabBadgeCount(tab.key, recordCount, shortLinkCount)
            const formattedCount = count !== null && count > 99 ? '99+' : count
            return (
              <button
                key={tab.key}
                type="button"
                onClick={(event) => {
                  event.currentTarget.blur()
                  onSelectTab(tab.key)
                }}
                aria-current={active ? 'page' : undefined}
                className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <span
                  className={cx(
                    'relative inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150',
                    active
                      ? 'bg-accent-500/14 text-accent-500'
                      : 'text-foreground-icon-secondary',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {count !== null && count > 0 ? (
                    <span
                      className={cx(
                        'absolute -top-0.5 end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-caption-2-semibold tabular-nums',
                        active
                          ? 'bg-accent-500 text-text-white'
                          : 'border border-separator-border bg-background-secondary-default text-text-secondary',
                      )}
                    >
                      {formattedCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cx(
                    'text-caption-2-medium transition-colors duration-150',
                    active ? 'text-text-primary' : 'text-text-tertiary',
                  )}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
