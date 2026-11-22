'use client'

import { useMemo, useState } from 'react'
import {
  RiBarChart2Line,
  RiDatabase2Line,
  RiFireLine,
  RiFlashlightLine,
  RiPulseLine,
} from '@remixicon/react'
import type { ConvertRecord } from '@/infra/kv/types'
import { Chip } from '@/components/base/badges/chip'
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import { useAdminStats, useAdminRecords, useAutoRefresh } from '@/components/use-admin-data'
import { cx } from '@/utils/cx'

interface AdminStatsProps {
  autoRefresh: boolean
}

type RangeKey = '7' | '14' | '30'

function formatNumber(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString('zh-CN')
}

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

export default function AdminStats({ autoRefresh }: AdminStatsProps) {
  const { stats, daily, loading, refresh } = useAdminStats()
  const { records } = useAdminRecords()
  const [range, setRange] = useState<RangeKey>('14')
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  useAutoRefresh(refresh, autoRefresh)

  const visibleDaily = useMemo(() => {
    const count = Number(range)
    return daily.slice(-count)
  }, [daily, range])

  const rangeTotal = useMemo(
    () => visibleDaily.reduce((sum, item) => sum + item.totalHits, 0),
    [visibleDaily],
  )

  const activeDay = useMemo(() => {
    if (visibleDaily.length === 0) return null
    if (hoveredDate) {
      const found = visibleDaily.find((item) => item.date === hoveredDate)
      if (found) return found
    }
    return visibleDaily[visibleDaily.length - 1]
  }, [visibleDaily, hoveredDate])

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

  const topRecords = useMemo(
    () => [...records].sort((a, b) => b.hits - a.hits).slice(0, 5),
    [records],
  )

  const maxDaily = Math.max(...visibleDaily.map((item) => item.totalHits), 1)
  const maxAllDaily = Math.max(...daily.map((item) => item.totalHits), 1)
  const maxRecordHits = Math.max(...topRecords.map((item) => item.hits), 1)

  const peakDayHits = useMemo(
    () => (daily.length > 0 ? Math.max(...daily.map((d) => d.totalHits)) : 0),
    [daily],
  )
  const activeDaysCount = useMemo(
    () => daily.filter((d) => d.totalHits > 0).length,
    [daily],
  )

  const activeRate =
    stats && stats.totalRecords > 0
      ? Math.round((stats.activeRecords / stats.totalRecords) * 100)
      : 0

  const tiles = [
    {
      label: '总转换次数',
      value: stats ? formatNumber(stats.totalHits) : '—',
      hint: '全部记录累计',
      badge: '累计',
      badgeColor: 'neutral' as const,
      icon: RiBarChart2Line,
    },
    {
      label: '今日转换',
      value: stats ? formatNumber(stats.todayHits) : '—',
      hint: '当天累计命中',
      badge: stats && stats.todayHits > 0 ? '活跃' : '待触发',
      badgeColor: stats && stats.todayHits > 0 ? ('lime' as const) : ('neutral' as const),
      icon: RiFlashlightLine,
    },
    {
      label: '有效订阅',
      value: stats ? formatNumber(stats.totalRecords) : '—',
      hint: '未含已禁用条目',
      badge: `共 ${records.length}`,
      badgeColor: 'neutral' as const,
      icon: RiDatabase2Line,
    },
    {
      label: '近 7 日活跃',
      value: stats ? formatNumber(stats.activeRecords) : '—',
      hint: '最近有客户端拉取',
      badge: `${activeRate}%`,
      badgeColor: activeRate >= 50 ? ('blue' as const) : ('neutral' as const),
      icon: RiPulseLine,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Stat Cards */}
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

      {/* BoardUI Signature Capsule-Tracked Bar Chart */}
      <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-caption-1-medium text-text-secondary">转换请求趋势</p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-title-1-semibold tabular-nums text-text-primary">
                {loading ? '—' : formatNumber(rangeTotal)}
              </span>
              <Chip variant="caption" color="blue">
                近 {range} 天累计
              </Chip>
            </div>
          </div>

          <SegmentedControl
            aria-label="趋势时间范围"
            selectedKeys={[range]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as RangeKey | undefined
              if (next) {
                setRange(next)
                setHoveredDate(null)
              }
            }}
          >
            <SegmentedControlItem id="7">7 天</SegmentedControlItem>
            <SegmentedControlItem id="14">14 天</SegmentedControlItem>
            <SegmentedControlItem id="30">30 天</SegmentedControlItem>
          </SegmentedControl>
        </div>

        {loading ? (
          <div className="flex h-40 items-end gap-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-full flex-1 rounded-lg" />
            ))}
          </div>
        ) : visibleDaily.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-xl bg-background-secondary-default text-body-2-regular text-text-tertiary">
            暂无数据，转换完成后这里会出现趋势图
          </div>
        ) : (
          <>
            <div
              className={cx(
                'flex h-40 items-end',
                range === '30' ? 'gap-1 sm:gap-1.5' : 'gap-2 sm:gap-2.5',
              )}
              role="img"
              aria-label={`近 ${visibleDaily.length} 天每日转换次数趋势`}
            >
              {visibleDaily.map((item, index) => {
                const isSelected = activeDay?.date === item.date
                const pct =
                  item.totalHits > 0
                    ? Math.max(Math.round((item.totalHits / maxDaily) * 100), 8)
                    : 0
                const showLabel =
                  range === '7' ||
                  (range === '14' && (index % 2 === 0 || index === visibleDaily.length - 1)) ||
                  (range === '30' && (index % 5 === 0 || index === visibleDaily.length - 1))

                return (
                  <div
                    key={item.date}
                    onMouseEnter={() => setHoveredDate(item.date)}
                    onFocus={() => setHoveredDate(item.date)}
                    tabIndex={0}
                    className="group flex h-full flex-1 cursor-pointer flex-col items-center gap-2 outline-none"
                  >
                    <div className="flex w-full max-w-7 flex-1 items-end overflow-hidden rounded-lg border border-separator-border/70 bg-background-secondary-default p-0.5">
                      {pct > 0 ? (
                        <div
                          className={cx(
                            'animate-bar-rise w-full rounded-[6px] transition-colors duration-150',
                            isSelected
                              ? 'bg-accent-500'
                              : 'bg-accent-400/65 group-hover:bg-accent-500',
                          )}
                          style={{
                            height: `${pct}%`,
                            animationDelay: `${Math.min(index * 18, 260)}ms`,
                          }}
                        />
                      ) : (
                        <div className="h-1 w-full rounded-full bg-separator-border" />
                      )}
                    </div>
                    <span
                      className={cx(
                        'h-4 font-mono text-caption-2-regular tabular-nums',
                        isSelected ? 'font-semibold text-text-primary' : 'text-text-tertiary',
                      )}
                    >
                      {showLabel ? shortDate(item.date) : ''}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-separator-border pt-3 font-mono text-caption-1-regular tabular-nums text-text-secondary">
              {activeDay ? (
                <span>
                  {shortDate(activeDay.date)} · {activeDay.totalHits} 次转换 · {activeDay.uniqueUrls} 个活跃订阅
                </span>
              ) : (
                <span>悬停柱条查看明细</span>
              )}
              <span className="font-sans text-caption-1-regular text-text-tertiary">
                Cloudflare KV 统计存在分钟级延迟
              </span>
            </div>

            <table className="sr-only">
              <caption>近 {visibleDaily.length} 天每日转换次数</caption>
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  <th scope="col">转换次数</th>
                  <th scope="col">订阅数</th>
                </tr>
              </thead>
              <tbody>
                {visibleDaily.map((item) => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td>{item.totalHits}</td>
                    <td>{item.uniqueUrls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Bento Bottom Grid: Client Breakdown + Activity Heatmap & Top Subscriptions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Client Distribution */}
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-medium text-text-primary">客户端分布</h2>
            <span className="text-caption-1-regular text-text-tertiary">按请求量</span>
          </div>

          {clientTypes.length === 0 ? (
            <p className="py-8 text-center text-body-2-regular text-text-tertiary">暂无客户端请求数据</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {clientTypes.map(({ type, hits, percent }, index) => (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-body-2-medium">
                    <span className="truncate font-mono text-text-primary" title={type}>
                      {type}
                    </span>
                    <span className="shrink-0 font-mono text-caption-1-regular tabular-nums text-text-secondary">
                      {formatNumber(hits)}（{percent}%）
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

        {/* 30-Day Activity Dot Matrix + Top 5 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-medium text-text-primary">近 30 天活跃度</h2>
              <span className="text-caption-1-regular tabular-nums text-text-tertiary">
                峰值 {formatNumber(peakDayHits)} · 活跃 {activeDaysCount} 天
              </span>
            </div>

            <div
              className="contributions-grid grid grid-cols-10 gap-1.5 sm:grid-cols-15"
              data-accent="blue"
            >
              {daily.length === 0
                ? Array.from({ length: 30 }).map((_, idx) => (
                    <span
                      key={idx}
                      data-tier="0"
                      className="contribution-cell aspect-square rounded-full"
                    />
                  ))
                : daily.map((item) => {
                    const ratio = item.totalHits / maxAllDaily
                    const tier =
                      item.totalHits === 0
                        ? 0
                        : ratio < 0.2
                          ? 1
                          : ratio < 0.4
                            ? 2
                            : ratio < 0.65
                              ? 3
                              : ratio < 0.85
                                ? 4
                                : 5
                    return (
                      <span
                        key={item.date}
                        data-tier={tier}
                        title={`${shortDate(item.date)}：${item.totalHits} 次转换`}
                        className="contribution-cell aspect-square rounded-full transition-transform duration-150 hover:scale-125"
                      />
                    )
                  })}
            </div>
          </div>

          <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-headline-medium text-text-primary">
                <RiFireLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                热门订阅 Top 5
              </span>
              <span className="text-caption-1-regular text-text-tertiary">累计命中</span>
            </div>

            {topRecords.length === 0 ? (
              <p className="py-4 text-center text-body-2-regular text-text-tertiary">暂无订阅数据</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {topRecords.map((record: ConvertRecord, index) => (
                  <li key={record.id} className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 font-mono text-caption-1-semibold tabular-nums text-text-tertiary">
                      {index + 1}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary"
                      title={record.name}
                    >
                      {record.name}
                    </span>
                    <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-background-secondary-default sm:block">
                      <div
                        className="h-full rounded-full bg-accent-500/80"
                        style={{ width: `${Math.max((record.hits / maxRecordHits) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-end font-mono text-caption-1-regular tabular-nums text-text-secondary">
                      {formatNumber(record.hits)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
