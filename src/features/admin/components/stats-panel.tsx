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
import { ActivityHeatmapCard, TopRecordsCard } from '@/features/admin/components/activity-heatmap-card'
import { TrendChartCard } from '@/features/admin/components/trend-chart-card'
import { useAdminStats } from '@/features/admin/hooks/use-admin-stats'
import { formatCount } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

interface StatsPanelProps {
  onUnauthorized?: () => void
}

export function StatsPanel({ onUnauthorized }: StatsPanelProps) {
  const { stats, daily, hourly, records, loading } = useAdminStats(onUnauthorized)

  const { clientTypes, totalClientHits } = useMemo(() => {
    const counts = new Map<string, number>()
    let sum = 0
    for (const record of records) {
      const type = record.clientType || 'unknown'
      counts.set(type, (counts.get(type) || 0) + record.hits)
      sum += record.hits
    }
    const list = Array.from(counts.entries())
      .map(([type, hits]) => {
        const rawPercent = sum > 0 ? (hits / sum) * 100 : 0
        const percentLabel =
          rawPercent > 0 && rawPercent < 1 ? '<1%' : `${Math.round(rawPercent)}%`
        return {
          type,
          hits,
          barValue: rawPercent > 0 ? Math.max(rawPercent, 1.5) : 0,
          percentLabel,
        }
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 6)

    return { clientTypes: list, totalClientHits: sum }
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
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Row 1: 4-Column KPI Telemetry Strip */}
      <LayerCard className="overflow-hidden p-0">
        <div className="grid grid-cols-2 bg-background-primary-default xl:grid-cols-4">
          {tiles.map((tile, idx) => {
            const Icon = tile.icon
            return (
              <div
                key={tile.label}
                className={cx(
                  'flex flex-col gap-1.5 p-3.5 sm:gap-2 sm:p-5',
                  idx % 2 === 1 && 'border-s border-separator-border',
                  idx >= 2 && 'border-t border-separator-border xl:border-t-0',
                  idx === 2 && 'xl:border-s xl:border-separator-border',
                )}
              >
                <div className="flex min-h-5 items-center justify-between gap-1.5">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-caption-1-medium text-text-secondary sm:text-body-2-medium">
                    <Icon
                      className="hidden size-3.5 shrink-0 text-foreground-icon-tertiary sm:inline-block"
                      aria-hidden
                    />
                    <span className="truncate">{tile.label}</span>
                  </span>
                  {tile.statusBadge ? (
                    <Badge
                      variant={tile.statusBadge.variant}
                      appearance="dot"
                      className="shrink-0"
                    >
                      {tile.statusBadge.label}
                    </Badge>
                  ) : null}
                </div>
                {loading && !stats ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-title-2-semibold tracking-[-0.02em] tabular-nums text-text-primary sm:text-title-1-semibold">
                    {tile.value}
                  </p>
                )}
                <p className="truncate text-caption-1-regular text-text-tertiary">{tile.hint}</p>
              </div>
            )
          })}
        </div>
      </LayerCard>

      {/* Row 2: Full-Width Edge-to-Edge Smooth Area Trend Chart */}
      <TrendChartCard daily={daily} hourly={hourly} loading={loading} />

      {/* Row 3: Geometrically Balanced 50/50 Split */}
      <div className="grid grid-cols-1 items-stretch gap-4 sm:gap-5 lg:grid-cols-2">
        <LayerCard className="flex h-full flex-col overflow-hidden">
          <LayerCard.Secondary className="my-0 flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
            <h2 className="text-body-semibold text-text-primary">客户端分布</h2>
            <span className="text-caption-1-regular tabular-nums text-text-tertiary">
              {totalClientHits > 0 ? `${formatCount(totalClientHits)} 次请求` : '暂无请求'}
            </span>
          </LayerCard.Secondary>

          <LayerCard.Primary className="flex flex-1 flex-col justify-between p-4 sm:p-5">
            {clientTypes.length === 0 ? (
              <p className="py-10 text-center text-body-2-regular text-text-tertiary">
                暂无客户端请求数据
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {clientTypes.map(({ type, hits, barValue, percentLabel }, index) => (
                  <Meter
                    key={type}
                    label={type}
                    value={barValue}
                    max={100}
                    customValue={`${formatCount(hits)} · ${percentLabel}`}
                    className="console-meter"
                    indicatorClassName={index === 0 ? 'bg-accent-500' : 'bg-accent-500/55'}
                  />
                ))}
              </div>
            )}
          </LayerCard.Primary>
        </LayerCard>

        <TopRecordsCard records={records} />
      </div>

      {/* Row 4: Full-Width 30-Day Activity Strip */}
      <ActivityHeatmapCard daily={daily} />
    </div>
  )
}
