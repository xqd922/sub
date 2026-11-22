'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  RiBarChart2Line,
  RiDatabase2Line,
  RiFlashlightLine,
  RiPulseLine,
} from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import { ActivityHeatmapCard } from '@/features/admin/components/activity-heatmap-card'
import { TrendChartCard } from '@/features/admin/components/trend-chart-card'
import { useAdminRecords } from '@/features/admin/hooks/use-admin-records'
import { useAdminStats } from '@/features/admin/hooks/use-admin-stats'
import { useAutoRefresh } from '@/features/shared/hooks/use-auto-refresh'
import { formatCount } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

interface StatsPanelProps {
  autoRefresh: boolean
  refreshSignal?: number
  onUnauthorized?: () => void
  onCountsLoaded?: (recordsTotal: number, shortLinksTotal: number) => void
}

export function StatsPanel({
  autoRefresh,
  refreshSignal = 0,
  onUnauthorized,
  onCountsLoaded,
}: StatsPanelProps) {
  const { stats, daily, loading, refresh } = useAdminStats(onUnauthorized)
  const { records, refresh: refreshRecords } = useAdminRecords(onUnauthorized)

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshRecords()])
  }, [refresh, refreshRecords])

  useAutoRefresh(refreshAll, autoRefresh)

  useEffect(() => {
    if (refreshSignal > 0) {
      void refreshAll()
    }
  }, [refreshSignal, refreshAll])

  useEffect(() => {
    if (stats) {
      onCountsLoaded?.(stats.totalRecords + stats.disabledRecords, stats.totalShortLinks)
    }
  }, [stats, onCountsLoaded])

  const clientTypes = useMemo(() => {
    const counts = new Map<string, number>()
    let sum = 0
    for (const record of records) {
      const type = record.clientType || 'unknown'
      counts.set(type, (counts.get(type) || 0) + record.hits)
      sum += record.hits
    }
    return Array.from(counts.entries())
      .map(([type, hits]) => ({
        type,
        hits,
        percent: sum > 0 ? Math.round((hits / sum) * 100) : 0,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 6)
  }, [records])

  const activeRate =
    stats && stats.totalRecords > 0
      ? Math.round((stats.activeRecords / stats.totalRecords) * 100)
      : 0

  const tiles = [
    {
      label: '总转换次数',
      value: stats ? formatCount(stats.totalHits) : '—',
      hint: '全部记录累计',
      badge: '累计',
      badgeColor: 'neutral' as const,
      icon: RiBarChart2Line,
    },
    {
      label: '今日转换',
      value: stats ? formatCount(stats.todayHits) : '—',
      hint: '当天累计命中',
      badge: stats && stats.todayHits > 0 ? '活跃' : '待触发',
      badgeColor: stats && stats.todayHits > 0 ? ('lime' as const) : ('neutral' as const),
      icon: RiFlashlightLine,
    },
    {
      label: '有效订阅',
      value: stats ? formatCount(stats.totalRecords) : '—',
      hint: stats
        ? stats.disabledRecords > 0
          ? `已禁用 ${stats.disabledRecords} 条 · 短链 ${stats.totalShortLinks} 条`
          : `短链 ${stats.totalShortLinks} 条`
        : '未含已禁用条目',
      badge: stats ? `共 ${stats.totalRecords + stats.disabledRecords}` : `共 ${records.length}`,
      badgeColor: 'neutral' as const,
      icon: RiDatabase2Line,
    },
    {
      label: '近 7 日活跃',
      value: stats ? formatCount(stats.activeRecords) : '—',
      hint: '最近有客户端拉取',
      badge: `${activeRate}%`,
      badgeColor: activeRate >= 50 ? ('blue' as const) : ('neutral' as const),
      icon: RiPulseLine,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <div
              key={tile.label}
              className="flex flex-col gap-2 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                  <Icon className="size-4 text-foreground-icon-tertiary" aria-hidden />
                  {tile.label}
                </span>
                <Chip variant="caption" color={tile.badgeColor}>
                  {tile.badge}
                </Chip>
              </div>
              {loading && !stats ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-title-1-semibold tabular-nums text-text-primary">{tile.value}</p>
              )}
              <p className="text-caption-1-regular text-text-tertiary">{tile.hint}</p>
            </div>
          )
        })}
      </div>

      <TrendChartCard daily={daily} loading={loading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-medium text-text-primary">客户端分布</h2>
            <span className="text-caption-1-regular text-text-tertiary">按请求量</span>
          </div>

          {clientTypes.length === 0 ? (
            <p className="py-8 text-center text-body-2-regular text-text-tertiary">
              暂无客户端请求数据
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {clientTypes.map(({ type, hits, percent }, index) => (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-body-2-medium">
                    <span className="truncate font-mono text-text-primary" title={type}>
                      {type}
                    </span>
                    <span className="shrink-0 font-mono text-caption-1-regular tabular-nums text-text-secondary">
                      {formatCount(hits)}（{percent}%）
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-background-secondary-default">
                    <div
                      className={cx(
                        'h-full rounded-full transition-all duration-300',
                        index === 0 ? 'bg-accent-500' : 'bg-accent-400/75',
                      )}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ActivityHeatmapCard daily={daily} records={records} />
      </div>
    </div>
  )
}
