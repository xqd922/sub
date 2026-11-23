'use client'

import { useMemo, useState } from 'react'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { RiFireLine } from '@remixicon/react'
import type { ConvertRecord, DailyStats } from '@/shared/admin.types'
import { formatCount, formatShortDate } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

const HEATMAP_TIER_CLASSES = [
  'bg-background-tertiary-default/80',
  'bg-accent-500/20',
  'bg-accent-500/40',
  'bg-accent-500/65',
  'bg-accent-500/85',
  'bg-accent-500',
] as const

function getHeatmapTier(hits: number, maxHits: number): number {
  if (hits === 0) return 0
  const ratio = hits / maxHits
  if (ratio < 0.2) return 1
  if (ratio < 0.4) return 2
  if (ratio < 0.65) return 3
  if (ratio < 0.85) return 4
  return 5
}

interface TopRecordsCardProps {
  records: ConvertRecord[]
}

export function TopRecordsCard({ records }: TopRecordsCardProps) {
  const topRecords = useMemo(
    () => [...records].sort((a, b) => b.hits - a.hits).slice(0, 5),
    [records],
  )
  const maxRecordHits = Math.max(...topRecords.map((item) => item.hits), 1)

  return (
    <LayerCard className="flex h-full flex-col overflow-hidden">
      <LayerCard.Secondary className="my-0 flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-body-semibold text-text-primary">
          <RiFireLine className="size-4 text-brand-cloudflare" aria-hidden />
          热门订阅 Top 5
        </span>
        <span className="text-caption-2-medium tracking-wider text-text-tertiary">HITS</span>
      </LayerCard.Secondary>

      <LayerCard.Primary className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        {topRecords.length === 0 ? (
          <p className="py-10 text-center text-body-2-regular text-text-tertiary">暂无订阅数据</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {topRecords.map((record, index) => {
              const barWidth = `${Math.max((record.hits / maxRecordHits) * 100, 4)}%`
              return (
                <li
                  key={record.id}
                  className="flex flex-col gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-background-secondary-default/55 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                    <span className="w-5 shrink-0 font-mono text-caption-1-medium tabular-nums text-text-tertiary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary"
                      title={record.name}
                    >
                      {record.name}
                    </span>
                    <span className="shrink-0 text-end text-body-2-regular tabular-nums text-text-secondary sm:hidden">
                      {formatCount(record.hits)}
                    </span>
                  </div>
                  <div className="ms-7 h-1.5 overflow-hidden rounded-full bg-background-secondary-default sm:ms-0 sm:w-24 sm:shrink-0 xl:w-32">
                    <div
                      className={cx(
                        'h-full rounded-full transition-all duration-300',
                        index === 0 ? 'bg-accent-500' : 'bg-accent-500/45',
                      )}
                      style={{ width: barWidth }}
                    />
                  </div>
                  <span className="hidden w-14 shrink-0 text-end text-body-2-regular tabular-nums text-text-secondary sm:inline">
                    {formatCount(record.hits)}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </LayerCard.Primary>
    </LayerCard>
  )
}

interface ActivityHeatmapCardProps {
  daily: DailyStats[]
}

export function ActivityHeatmapCard({ daily }: ActivityHeatmapCardProps) {
  const [hovered, setHovered] = useState<DailyStats | null>(null)

  const maxAllDaily = Math.max(...daily.map((item) => item.totalHits), 1)
  const peakDayHits = useMemo(
    () => (daily.length > 0 ? Math.max(...daily.map((item) => item.totalHits)) : 0),
    [daily],
  )
  const activeDaysCount = useMemo(
    () => daily.filter((item) => item.totalHits > 0).length,
    [daily],
  )

  const rangeStart = daily.length > 0 ? formatShortDate(daily[0].date) : '30 天前'
  const rangeEnd = daily.length > 0 ? formatShortDate(daily[daily.length - 1].date) : '今日'

  return (
    <LayerCard className="overflow-hidden">
      <LayerCard.Secondary className="my-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <h2 className="text-body-semibold text-text-primary">近 30 天活跃度</h2>
        <span className="text-caption-1-regular tabular-nums text-text-secondary">
          {hovered
            ? `${formatShortDate(hovered.date)} · ${formatCount(hovered.totalHits)} 次 · ${hovered.uniqueUrls} 订阅`
            : `峰值 ${formatCount(peakDayHits)} · 活跃 ${activeDaysCount} 天`}
        </span>
      </LayerCard.Secondary>

      <LayerCard.Primary className="flex flex-col gap-3 p-4 sm:p-5">
        <div
          className="grid grid-cols-10 gap-1.5 sm:grid-cols-15 lg:grid-cols-[repeat(30,minmax(0,1fr))]"
          onMouseLeave={() => setHovered(null)}
        >
          {daily.length === 0
            ? Array.from({ length: 30 }).map((_, idx) => (
                <span
                  key={idx}
                  className="aspect-square rounded-[4px] bg-background-tertiary-default/80"
                />
              ))
            : daily.map((item) => {
                const tier = getHeatmapTier(item.totalHits, maxAllDaily)
                const isSelected = hovered?.date === item.date
                return (
                  <button
                    key={item.date}
                    type="button"
                    onMouseEnter={() => setHovered(item)}
                    onFocus={() => setHovered(item)}
                    onClick={() => setHovered(item)}
                    title={`${formatShortDate(item.date)}：${item.totalHits} 次转换`}
                    aria-label={`${formatShortDate(item.date)}：${item.totalHits} 次转换`}
                    className={cx(
                      'aspect-square w-full cursor-pointer rounded-[4px] transition-transform duration-150 outline-none hover:scale-115 hover:ring-1 hover:ring-accent-500 focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                      HEATMAP_TIER_CLASSES[tier],
                      isSelected && 'scale-110 ring-1 ring-accent-500',
                    )}
                  />
                )
              })}
        </div>

        <div className="flex items-center justify-between gap-2 text-caption-1-regular text-text-tertiary">
          <span className="font-mono tabular-nums">
            {rangeStart} → {rangeEnd}
          </span>
          <div className="flex items-center gap-1.5">
            <span>低</span>
            {HEATMAP_TIER_CLASSES.map((cls, idx) => (
              <span key={idx} className={cx('size-2.5 rounded-[2px]', cls)} aria-hidden />
            ))}
            <span>高</span>
          </div>
        </div>
      </LayerCard.Primary>
    </LayerCard>
  )
}
