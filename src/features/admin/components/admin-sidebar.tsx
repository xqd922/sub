'use client'

import Link from 'next/link'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import {
  RiArrowLeftLine,
  RiBarChartBoxLine,
  RiEqualizerLine,
  RiFileList3Line,
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
  code: string
  description: string
  icon: typeof RiBarChartBoxLine
}

export const ADMIN_TABS: readonly AdminTabMeta[] = [
  {
    key: 'stats',
    label: '概览',
    code: 'Overview',
    description: '实时转换趋势、客户端占比与活跃热力图',
    icon: RiBarChartBoxLine,
  },
  {
    key: 'records',
    label: '订阅',
    code: 'Subscriptions',
    description: '管理订阅启停、在线节点检测与元数据详情',
    icon: RiFileList3Line,
  },
  {
    key: 'shortLinks',
    label: '短链',
    code: 'Short Links',
    description: '自定义短码、输出格式、访问密钥与导入导出',
    icon: RiLinkM,
  },
  {
    key: 'config',
    label: '配置',
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
      <aside
        aria-label="后台导航"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[236px] lg:shrink-0 lg:flex-col lg:border-e lg:border-separator-border lg:bg-background-secondary-default lg:px-3 lg:py-3.5"
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
            <span className="truncate font-mono text-body-2-semibold tracking-tight text-text-primary">
              SubConvert
            </span>
          </span>
          <span className="rounded border border-separator-border bg-background-primary-default px-1.5 py-0.5 font-mono text-caption-2-medium text-text-tertiary">
            EDGE
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="mt-3 flex h-8.5 w-full cursor-pointer items-center justify-between rounded-lg border border-separator-border bg-background-primary-default px-2.5 text-caption-1-regular text-text-tertiary shadow-2xs transition-colors duration-150 hover:border-border-button-hover hover:text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span className="inline-flex items-center gap-2">
            <RiSearchLine className="size-3.5 shrink-0" aria-hidden />
            <span>命令面板…</span>
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <div className="mt-5 px-2 font-mono text-caption-2-semibold tracking-wider text-text-tertiary uppercase">
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
                  'relative flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-body-2-medium transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  active
                    ? 'bg-background-primary-default text-text-primary shadow-2xs ring-1 ring-separator-border'
                    : 'text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary',
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
                      'rounded-md px-1.5 py-0.5 font-mono text-caption-2-medium tabular-nums',
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
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-caption-1-medium text-text-secondary transition-colors duration-150 hover:bg-background-primary-default hover:text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiArrowLeftLine className="size-3.5" aria-hidden />
            <span>转换首页</span>
          </Link>

          <div className="flex items-center gap-0.5">
            <ThemeIconButton className="hover:bg-background-primary-default" />
            <Tooltip
              content="退出登录"
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

      <header className="sticky top-0 z-20 flex flex-col border-b border-separator-border bg-background-primary-default/95 backdrop-blur-md lg:hidden">
        <div className="flex h-13 items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 font-mono text-body-2-semibold text-text-primary"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-brand-cloudflare shadow-[0_0_8px_var(--color-brand-cloudflare)]"
            />
            <span className="truncate">SubConvert</span>
            <span className="text-caption-1-regular text-text-tertiary">/</span>
            <span className="truncate text-caption-1-medium text-text-secondary">Console</span>
          </Link>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="命令面板"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary"
            >
              <RiSearchLine className="size-4" aria-hidden />
            </button>
            <Link
              href="/"
              aria-label="返回首页"
              className="inline-flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-primary"
            >
              <RiArrowLeftLine className="size-4" aria-hidden />
            </Link>
            <ThemeIconButton />
            <button
              type="button"
              onClick={onLogout}
              aria-label="退出登录"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-background-secondary-default hover:text-text-error-primary"
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
                    : 'text-text-secondary hover:bg-background-secondary-default/60 hover:text-text-primary',
                )}
              >
                <Icon
                  className={cx('size-3.5 shrink-0', active && 'text-accent-500')}
                  aria-hidden
                />
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
