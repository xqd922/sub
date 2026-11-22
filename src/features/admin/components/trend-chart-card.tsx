'use client'

import { useMemo, useState } from 'react'
import { Chip } from '@/components/base/badges/chip'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import type { DailyStats } from '@/shared/admin.types'
import { formatCount, formatShortDate } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

type RangeKey = '7' | '14' | '30'

interface TrendChartCardProps {
  daily: DailyStats[]
  loading: boolean
}

export function TrendChartCard({ daily, loading }: TrendChartCardProps) {
  const [range, setRange] = useState<RangeKey>('14')
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const visibleDaily = useMemo(() => daily.slice(-Number(range)), [daily, range])

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

  const maxDaily = Math.max(...visibleDaily.map((item) => item.totalHits), 1)

  return (
    <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-caption-1-medium text-text-secondary">转换请求趋势</p>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="text-title-1-semibold tabular-nums text-text-primary">
              {loading ? '—' : formatCount(rangeTotal)}
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
          {Array.from({ length: 14 }).map((_, index) => (
            <Skeleton key={index} className="h-full flex-1 rounded-lg" />
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
                    {showLabel ? formatShortDate(item.date) : ''}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-separator-border pt-3 font-mono text-caption-1-regular tabular-nums text-text-secondary">
            {activeDay ? (
              <span>
                {formatShortDate(activeDay.date)} · {activeDay.totalHits} 次转换 ·{' '}
                {activeDay.uniqueUrls} 个活跃订阅
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
  )
}
