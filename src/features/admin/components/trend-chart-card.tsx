'use client'

import { useId, useMemo, useState } from 'react'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import type { DailyStats } from '@/shared/admin.types'
import { formatCount, formatShortDate } from '@/shared/format.utils'

type RangeKey = '7' | '14' | '30'

interface TrendChartCardProps {
  daily: DailyStats[]
  loading: boolean
}

const RANGE_TABS: Array<{ value: RangeKey; label: string }> = [
  { value: '7', label: '7 天' },
  { value: '14', label: '14 天' },
  { value: '30', label: '30 天' },
]

interface ChartPoint {
  x: number
  y: number
  date: string
  hits: number
  uniqueUrls: number
}

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 188
const PAD_LEFT = 42
const PAD_RIGHT = 14
const PAD_TOP = 16
const PAD_BOTTOM = 28

/** Monotone cubic bezier path preventing vertical overshoot on flat segments */
function buildSmoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const cx = ((p0.x + p1.x) / 2).toFixed(2)
    d += ` C ${cx} ${p0.y.toFixed(2)}, ${cx} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
  }
  return d
}

export function TrendChartCard({ daily, loading }: TrendChartCardProps) {
  const gradientId = useId()
  const [range, setRange] = useState<RangeKey>('14')
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const visibleDaily = useMemo(() => daily.slice(-Number(range)), [daily, range])

  const rangeTotal = useMemo(
    () => visibleDaily.reduce((sum, item) => sum + item.totalHits, 0),
    [visibleDaily],
  )

  const maxDaily = useMemo(() => {
    const peak = Math.max(...visibleDaily.map((item) => item.totalHits), 0)
    if (peak <= 4) return Math.max(peak, 4)
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)))
    return Math.ceil(peak / magnitude) * magnitude
  }, [visibleDaily])

  const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM
  const baselineY = PAD_TOP + plotHeight

  const points = useMemo<ChartPoint[]>(() => {
    const count = visibleDaily.length
    if (count === 0) return []
    return visibleDaily.map((item, idx) => {
      const x = count === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (idx / (count - 1)) * plotWidth
      const ratio = maxDaily > 0 ? item.totalHits / maxDaily : 0
      const y = baselineY - ratio * plotHeight
      return {
        x,
        y,
        date: item.date,
        hits: item.totalHits,
        uniqueUrls: item.uniqueUrls,
      }
    })
  }, [visibleDaily, plotWidth, plotHeight, baselineY, maxDaily])

  const activePoint = useMemo(() => {
    if (points.length === 0) return null
    if (hoveredDate) {
      const found = points.find((pt) => pt.date === hoveredDate)
      if (found) return found
    }
    return points[points.length - 1]
  }, [points, hoveredDate])

  const linePath = useMemo(() => buildSmoothLinePath(points), [points])
  const areaPath = useMemo(() => {
    if (points.length === 0) return ''
    const first = points[0]
    const last = points[points.length - 1]
    return `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
  }, [linePath, points, baselineY])

  const yTicks = [0, Math.round(maxDaily / 2), maxDaily]

  return (
    <LayerCard className="overflow-hidden">
      <LayerCard.Secondary className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-body-semibold text-text-primary">转换请求趋势</h2>
          <span className="font-mono text-title-3-semibold tabular-nums text-text-primary">
            {loading ? '—' : formatCount(rangeTotal)}
          </span>
          <span className="font-mono text-caption-2-regular text-text-tertiary">
            近 {range} 天累计
          </span>
        </div>

        <Tabs
          variant="segmented"
          size="sm"
          tabs={RANGE_TABS}
          value={range}
          onValueChange={(next) => {
            setRange(next as RangeKey)
            setHoveredDate(null)
          }}
        />
      </LayerCard.Secondary>

      <LayerCard.Primary className="p-4 sm:p-5">
        {loading ? (
          <Skeleton className="h-[188px] w-full rounded-lg" />
        ) : visibleDaily.length === 0 ? (
          <div className="flex h-[188px] items-center justify-center rounded-lg border border-dashed border-separator-border bg-background-secondary-default/40 text-body-2-regular text-text-tertiary">
            暂无趋势数据，完成首次订阅转换后将自动生成曲线
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-caption-1-regular tabular-nums">
              {activePoint ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-text-primary">
                    <span className="size-2 rounded-full bg-accent-500" aria-hidden />
                    {formatShortDate(activePoint.date)}
                  </span>
                  <span>
                    <strong className="font-semibold text-text-primary">
                      {formatCount(activePoint.hits)}
                    </strong>{' '}
                    次转换
                  </span>
                  <span>
                    <strong className="font-semibold text-text-primary">
                      {activePoint.uniqueUrls}
                    </strong>{' '}
                    活跃订阅
                  </span>
                </div>
              ) : (
                <span className="text-text-tertiary">移动指针查看每日请求明细</span>
              )}
              <span className="font-sans text-caption-2-regular text-text-tertiary">
                Cloudflare KV 分钟级汇总
              </span>
            </div>

            <div className="w-full" dir="ltr">
              <svg
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                className="h-[188px] w-full overflow-visible select-none"
                role="img"
                aria-label={`近 ${visibleDaily.length} 天每日转换次数趋势图`}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Horizontal gridlines + Y-axis labels */}
                {yTicks.map((tick) => {
                  const y = baselineY - (maxDaily > 0 ? (tick / maxDaily) * plotHeight : 0)
                  return (
                    <g key={tick}>
                      <line
                        x1={PAD_LEFT}
                        x2={VIEW_WIDTH - PAD_RIGHT}
                        y1={y}
                        y2={y}
                        stroke="var(--color-separator-border)"
                        strokeDasharray={tick === 0 ? undefined : '3 3'}
                        strokeWidth={1}
                      />
                      <text
                        x={PAD_LEFT - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        fill="var(--color-text-tertiary)"
                        fontSize={10.5}
                        fontFamily="var(--font-mono)"
                      >
                        {formatCount(tick)}
                      </text>
                    </g>
                  )
                })}

                {/* Smooth gradient area + crisp line */}
                {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
                {linePath ? (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--color-accent-500)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Active crosshair & dot */}
                {activePoint ? (
                  <g>
                    <line
                      x1={activePoint.x}
                      x2={activePoint.x}
                      y1={PAD_TOP}
                      y2={baselineY}
                      stroke="var(--color-accent-500)"
                      strokeOpacity={0.35}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r={6}
                      fill="var(--color-accent-500)"
                      fillOpacity={0.18}
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r={3.25}
                      fill="var(--color-background-primary-default)"
                      stroke="var(--color-accent-500)"
                      strokeWidth={2}
                    />
                  </g>
                ) : null}

                {/* X-axis labels */}
                {points.map((pt, idx) => {
                  const showLabel =
                    range === '7' ||
                    (range === '14' && (idx % 2 === 0 || idx === points.length - 1)) ||
                    (range === '30' && (idx % 5 === 0 || idx === points.length - 1))
                  if (!showLabel) return null
                  const isActive = activePoint?.date === pt.date
                  return (
                    <text
                      key={pt.date}
                      x={pt.x}
                      y={VIEW_HEIGHT - 6}
                      textAnchor={
                        idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'
                      }
                      fill={isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'}
                      fontWeight={isActive ? 600 : 400}
                      fontSize={10.5}
                      fontFamily="var(--font-mono)"
                    >
                      {formatShortDate(pt.date)}
                    </text>
                  )
                })}

                {/* Interactive hover slices */}
                {points.map((pt, idx) => {
                  const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth
                  const sliceX = Math.max(PAD_LEFT, pt.x - step / 2)
                  const sliceWidth =
                    idx === 0 || idx === points.length - 1 ? step / 2 : step
                  return (
                    <rect
                      key={`hit-${pt.date}`}
                      x={sliceX}
                      y={PAD_TOP}
                      width={Math.max(sliceWidth, 8)}
                      height={plotHeight + PAD_BOTTOM}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredDate(pt.date)}
                      onFocus={() => setHoveredDate(pt.date)}
                      tabIndex={0}
                      aria-label={`${formatShortDate(pt.date)}：${pt.hits} 次转换`}
                    />
                  )
                })}
              </svg>
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
      </LayerCard.Primary>
    </LayerCard>
  )
}
