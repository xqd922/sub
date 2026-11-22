'use client'

import { useMemo } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Meter } from '@cloudflare/kumo/components/meter'
import {
  RiBarChart2Line,
  RiDatabase2Line,
  RiFlashlightLine,
  RiPulseLine,
} from '@remixicon/react'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import { ActivityHeatmapCard } from '@/features/admin/components/activity-heatmap-card'
import { TrendChartCard } from '@/features/admin/components/trend-chart-card'
import { useAdminStats } from '@/features/admin/hooks/use-admin-stats'
import { formatCount } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

interface StatsPanelProps {
  onUnauthorized?: () => void
}

export function StatsPanel({ onUnauthorized }: StatsPanelProps) {
  const { stats, daily, records, loading } = useAdminStats(onUnauthorized)

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
      hint: '全周期累计命中',
      icon: RiBarChart2Line,
      statusBadge: null,
    },
    {
      label: '今日转换',
      value: stats ? formatCount(stats.todayHits) : '—',
      hint: 'UTC 00:00 起统计',
      icon: RiFlashlightLine,
      statusBadge:
        stats && stats.todayHits > 0
          ? { label: '运行中', variant: 'success' as const }
          : { label: '空闲', variant: 'neutral' as const },
    },
    {
      label: '有效订阅',
      value: stats ? formatCount(stats.totalRecords) : '—',
      hint: stats
        ? stats.disabledRecords > 0
          ? `禁用 ${stats.disabledRecords} · 短链 ${stats.totalShortLinks}`
          : `关联短链 ${stats.totalShortLinks} 条`
        : '实时同步 KV 记录',
      icon: RiDatabase2Line,
      statusBadge: null,
    },
    {
      label: '近 7 日活跃',
      value: stats ? formatCount(stats.activeRecords) : '—',
      hint: '近期有客户端拉取',
      icon: RiPulseLine,
      statusBadge: {
        label: `${activeRate}%`,
        variant: activeRate >= 50 ? ('success' as const) : ('neutral' as const),
      },
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <LayerCard className="overflow-hidden p-0">
        <div className="grid grid-cols-2 bg-background-primary-default xl:grid-cols-4">
          {tiles.map((tile, idx) => {
            const Icon = tile.icon
            return (
              <div
                key={tile.label}
                className={cx(
                  'flex flex-col gap-2 p-4 sm:p-5',
                  idx % 2 === 1 && 'border-s border-separator-border',
                  idx >= 2 && 'border-t border-separator-border xl:border-t-0',
                  idx === 2 && 'xl:border-s xl:border-separator-border',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                    <Icon className="size-3.5 text-foreground-icon-tertiary" aria-hidden />
                    {tile.label}
                  </span>
                  {tile.statusBadge ? (
                    <Badge variant={tile.statusBadge.variant} appearance="dot">
                      {tile.statusBadge.label}
                    </Badge>
                  ) : null}
                </div>
                {loading && !stats ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="font-mono text-title-1-semibold tracking-tight tabular-nums text-text-primary">
                    {tile.value}
                  </p>
                )}
                <p className="text-caption-2-regular text-text-tertiary">{tile.hint}</p>
              </div>
            )
          })}
        </div>
      </LayerCard>

      <TrendChartCard daily={daily} loading={loading} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LayerCard className="overflow-hidden">
          <LayerCard.Secondary className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
            <h2 className="text-body-semibold text-text-primary">客户端分布</h2>
            <span className="font-mono text-caption-2-regular text-text-tertiary">BY REQUESTS</span>
          </LayerCard.Secondary>

          <LayerCard.Primary className="p-4 sm:p-5">
            {clientTypes.length === 0 ? (
              <p className="py-10 text-center text-body-2-regular text-text-tertiary">
                暂无客户端请求数据
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {clientTypes.map(({ type, hits, percent }, index) => (
                  <Meter
                    key={type}
                    label={type}
                    value={Math.max(percent, 2)}
                    max={100}
                    customValue={`${formatCount(hits)} · ${percent}%`}
                    indicatorClassName={index === 0 ? 'bg-accent-500' : 'bg-accent-500/55'}
                  />
                ))}
              </div>
            )}
          </LayerCard.Primary>
        </LayerCard>

        <ActivityHeatmapCard daily={daily} records={records} />
      </div>
    </div>
  )
}
