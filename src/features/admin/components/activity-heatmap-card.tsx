'use client'

import { useMemo } from 'react'
import { RiFireLine } from '@remixicon/react'
import type { ConvertRecord, DailyStats } from '@/shared/admin.types'
import { formatCount, formatShortDate } from '@/shared/format.utils'

interface ActivityHeatmapCardProps {
  daily: DailyStats[]
  records: ConvertRecord[]
}

function getHeatmapTier(hits: number, maxHits: number): number {
  if (hits === 0) return 0
  const ratio = hits / maxHits
  if (ratio < 0.2) return 1
  if (ratio < 0.4) return 2
  if (ratio < 0.65) return 3
  if (ratio < 0.85) return 4
  return 5
}

export function ActivityHeatmapCard({ daily, records }: ActivityHeatmapCardProps) {
  const topRecords = useMemo(
    () => [...records].sort((a, b) => b.hits - a.hits).slice(0, 5),
    [records],
  )

  const maxAllDaily = Math.max(...daily.map((item) => item.totalHits), 1)
  const maxRecordHits = Math.max(...topRecords.map((item) => item.hits), 1)

  const peakDayHits = useMemo(
    () => (daily.length > 0 ? Math.max(...daily.map((item) => item.totalHits)) : 0),
    [daily],
  )
  const activeDaysCount = useMemo(
    () => daily.filter((item) => item.totalHits > 0).length,
    [daily],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-headline-medium text-text-primary">近 30 天活跃度</h2>
          <span className="text-caption-1-regular tabular-nums text-text-tertiary">
            峰值 {formatCount(peakDayHits)} · 活跃 {activeDaysCount} 天
          </span>
        </div>

        <div className="contributions-grid grid grid-cols-10 gap-1.5 sm:grid-cols-15" data-accent="blue">
          {daily.length === 0
            ? Array.from({ length: 30 }).map((_, idx) => (
                <span key={idx} data-tier="0" className="contribution-cell aspect-square rounded-full" />
              ))
            : daily.map((item) => (
                <span
                  key={item.date}
                  data-tier={getHeatmapTier(item.totalHits, maxAllDaily)}
                  title={`${formatShortDate(item.date)}：${item.totalHits} 次转换`}
                  className="contribution-cell aspect-square rounded-full transition-transform duration-150 hover:scale-125"
                />
              ))}
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
            {topRecords.map((record, index) => (
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
                  {formatCount(record.hits)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
