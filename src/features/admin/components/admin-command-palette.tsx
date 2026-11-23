'use client'

import { useMemo, useState } from 'react'
import { CommandPalette } from '@cloudflare/kumo/components/command-palette'
import {
  RiArrowLeftLine,
  RiBarChartBoxLine,
  RiEqualizerLine,
  RiFileList3Line,
  RiLinkM,
  RiLogoutBoxRLine,
  RiMoonLine,
  RiSearchLine,
  RiSunLine,
} from '@remixicon/react'
import {
  applyThemeWithTransition,
  useThemeMode,
} from '@/components/application/theme/theme-toggle'
import { Modal } from '@/components/base/modal/modal'
import type { AdminTabKey } from '@/features/admin/components/admin-sidebar'

interface PaletteItem {
  id: string
  title: string
  hint: string
  keywords: string
  icon: typeof RiBarChartBoxLine
  action: () => void
}

interface PaletteGroup {
  id: string
  label: string
  items: PaletteItem[]
}

interface AdminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTab: (tab: AdminTabKey) => void
  onFocusRecordSearch: () => void
  onGoHome: () => void
  onLogout: () => void
}

export function AdminCommandPalette({
  open,
  onOpenChange,
  onSelectTab,
  onFocusRecordSearch,
  onGoHome,
  onLogout,
}: AdminCommandPaletteProps) {
  const [search, setSearch] = useState('')
  const theme = useThemeMode()

  const groups = useMemo<PaletteGroup[]>(
    () => [
      {
        id: 'navigation',
        label: '控制台导航',
        items: [
          {
            id: 'nav-stats',
            title: '概览',
            hint: '转换趋势、客户端占比与热力图',
            keywords: 'stats overview 概览 统计 趋势 图表',
            icon: RiBarChartBoxLine,
            action: () => onSelectTab('stats'),
          },
          {
            id: 'nav-records',
            title: '订阅管理',
            hint: '管理订阅启停、在线检测与详情抽屉',
            keywords: 'records subscriptions 订阅 记录 节点 检测',
            icon: RiFileList3Line,
            action: () => onSelectTab('records'),
          },
          {
            id: 'nav-short-links',
            title: '短链管理',
            hint: '自定义短码、密钥保护与导入导出',
            keywords: 'short links 短链 短码 slug 导出 导入',
            icon: RiLinkM,
            action: () => onSelectTab('shortLinks'),
          },
          {
            id: 'nav-config',
            title: '配置中心',
            hint: '自定义分流规则与客户端 UA 适配',
            keywords: 'config rules 配置 分流 规则 ua client',
            icon: RiEqualizerLine,
            action: () => onSelectTab('config'),
          },
        ],
      },
      {
        id: 'actions',
        label: '快捷指令',
        items: [
          {
            id: 'act-search-records',
            title: '搜索订阅记录',
            hint: '跳转订阅页并聚焦搜索框',
            keywords: 'search filter 搜索 订阅',
            icon: RiSearchLine,
            action: onFocusRecordSearch,
          },
          {
            id: 'act-theme',
            title: theme === 'dark' ? '切换为浅色模式' : '切换为深色模式',
            hint: '立即切换全局亮暗外观',
            keywords: 'theme dark light 主题 深色 浅色',
            icon: theme === 'dark' ? RiSunLine : RiMoonLine,
            action: () => void applyThemeWithTransition(theme === 'dark' ? 'light' : 'dark'),
          },
          {
            id: 'act-home',
            title: '返回订阅转换首页',
            hint: '打开前台转换工具页',
            keywords: 'home index 首页 前台 转换',
            icon: RiArrowLeftLine,
            action: onGoHome,
          },
          {
            id: 'act-logout',
            title: '退出管理员登录',
            hint: '清除当前管理会话',
            keywords: 'logout signout 退出 登录',
            icon: RiLogoutBoxRLine,
            action: onLogout,
          },
        ],
      },
    ],
    [onSelectTab, onFocusRecordSearch, onGoHome, onLogout, theme],
  )

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return groups
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.hint.toLowerCase().includes(query) ||
            item.keywords.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, search])

  const handleSelect = (item: PaletteItem) => {
    onOpenChange(false)
    setSearch('')
    item.action()
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setSearch('')
      }}
      size="lg"
      aria-label="快捷导航与命令面板"
      overlayClassName="items-start pt-[calc(env(safe-area-inset-top)+2.5rem)] sm:pt-[12vh]"
      className="gap-0 overflow-hidden rounded-2xl p-0"
    >
      <CommandPalette.Panel
        open={open}
        items={filteredGroups}
        value={search}
        onValueChange={setSearch}
        itemToStringValue={(group: PaletteGroup) => group.label}
        onSelect={(item: PaletteItem) => handleSelect(item)}
        getSelectableItems={(allGroups: PaletteGroup[]) =>
          allGroups.flatMap((group) => group.items)
        }
        className="max-h-[72dvh] rounded-none bg-background-primary-default sm:max-h-[60vh]"
      >
        <CommandPalette.Input placeholder="输入命令或搜索控制台页面…" />
        <CommandPalette.List className="rounded-none bg-background-primary-default ring-0 border-t border-separator-border">
          <CommandPalette.Results>
            {(group: PaletteGroup) => (
              <CommandPalette.Group key={group.id} items={group.items}>
                <CommandPalette.GroupLabel>{group.label}</CommandPalette.GroupLabel>
                <CommandPalette.Items>
                  {(item: PaletteItem) => {
                    const Icon = item.icon
                    return (
                      <CommandPalette.Item
                        key={item.id}
                        value={item}
                        onClick={() => handleSelect(item)}
                        className="py-2.5 sm:py-1.5"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Icon
                            className="size-4 shrink-0 text-foreground-icon-secondary"
                            aria-hidden
                          />
                          <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2.5">
                            <span className="truncate text-body-medium text-text-primary">
                              {item.title}
                            </span>
                            <span className="truncate text-caption-1-regular text-text-tertiary sm:text-body-2-regular">
                              {item.hint}
                            </span>
                          </span>
                        </span>
                      </CommandPalette.Item>
                    )
                  }}
                </CommandPalette.Items>
              </CommandPalette.Group>
            )}
          </CommandPalette.Results>
          <CommandPalette.Empty>未找到匹配的页面或命令</CommandPalette.Empty>
        </CommandPalette.List>
        <div className="hidden items-center justify-between border-t border-separator-border bg-background-secondary-default px-4 py-2.5 sm:flex">
          <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            <kbd className="rounded border border-separator-border bg-background-primary-default px-1.5 py-0.5 font-mono text-caption-2-medium text-text-secondary">
              ↑↓
            </kbd>
            <span>选择</span>
          </span>
          <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            <kbd className="rounded border border-separator-border bg-background-primary-default px-1.5 py-0.5 font-mono text-caption-2-medium text-text-secondary">
              ↵
            </kbd>
            <span>执行</span>
          </span>
          <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            <kbd className="rounded border border-separator-border bg-background-primary-default px-1.5 py-0.5 font-mono text-caption-2-medium text-text-secondary">
              Esc
            </kbd>
            <span>关闭</span>
          </span>
        </div>
      </CommandPalette.Panel>
    </Modal>
  )
}
