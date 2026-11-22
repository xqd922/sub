'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import type { DailyStats, HourlyStats } from '@/shared/admin.types'
import {
  formatCount,
  formatHourDateTime,
  formatHourTick,
  formatShortDate,
} from '@/shared/format.utils'

type RangeKey = '24h' | '7d' | '30d'

interface TrendChartCardProps {
  daily: DailyStats[]
  hourly: HourlyStats[]
  loading: boolean
}

const RANGE_TABS: Array<{ value: RangeKey; label: string }> = [
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
]

const RANGE_SUMMARY_LABEL: Record<RangeKey, string> = {
  '24h': '近 24 小时累计',
  '7d': '近 7 天累计',
  '30d': '近 30 天累计',
}

interface SeriesItem {
  key: string
  tickLabel: string
  readoutLabel: string
  hits: number
  uniqueUrls: number
}

interface ChartPoint extends SeriesItem {
  x: number
  y: number
}

const CHART_HEIGHT = 204
const PAD_LEFT = 38
const PAD_RIGHT = 12
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

function buildHourlySeries(hourly: HourlyStats[]): SeriesItem[] {
  const byHour = new Map(hourly.map((item) => [item.hour, item]))
  const anchor = new Date()
  anchor.setUTCMinutes(0, 0, 0)

  const items: SeriesItem[] = []
  for (let i = 23; i >= 0; i--) {
    const bucket = new Date(anchor.getTime() - i * 3_600_000)
    const hourKey = bucket.toISOString().slice(0, 13)
    const matched = byHour.get(hourKey)
    items.push({
      key: hourKey,
      tickLabel: formatHourTick(hourKey),
      readoutLabel: formatHourDateTime(hourKey),
      hits: matched?.totalHits || 0,
      uniqueUrls: matched?.uniqueUrls || 0,
    })
  }
  return items
}

function buildDailySeries(daily: DailyStats[], days: number): SeriesItem[] {
  const byDate = new Map(daily.map((item) => [item.date, item]))
  const anchor = new Date()
  anchor.setUTCHours(0, 0, 0, 0)

  const items: SeriesItem[] = []
  for (let i = days - 1; i >= 0; i--) {
    const bucket = new Date(anchor.getTime() - i * 86_400_000)
    const dateKey = bucket.toISOString().slice(0, 10)
    const matched = byDate.get(dateKey)
    const label = formatShortDate(dateKey)
    items.push({
      key: dateKey,
      tickLabel: label,
      readoutLabel: label,
      hits: matched?.totalHits || 0,
      uniqueUrls: matched?.uniqueUrls || 0,
    })
  }
  return items
}

export function TrendChartCard({ daily, hourly, loading }: TrendChartCardProps) {
  const gradientId = useId()
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [chartWidth, setChartWidth] = useState(960)
  const [range, setRange] = useState<RangeKey>('24h')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // 通过回调 ref 跟踪真实挂载的图表容器宽度，确保从 loading/空态切换为有数据后
  // ResizeObserver 仍能第一时间绑定，让折线图在任意屏幕 100% 铺满且不变形
  useEffect(() => {
    if (!containerEl) return

    const updateWidth = () => {
      const measured = Math.round(containerEl.getBoundingClientRect().width)
      if (measured <= 0) return
      const next = Math.max(measured, 280)
      setChartWidth((prev) => (prev === next ? prev : next))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(containerEl)
    return () => observer.disconnect()
  }, [containerEl])

  const hasAnyHistory = useMemo(
    () =>
      daily.some((item) => item.totalHits > 0) || hourly.some((item) => item.totalHits > 0),
    [daily, hourly],
  )

  const series = useMemo<SeriesItem[]>(() => {
    if (!hasAnyHistory) return []
    if (range === '24h') return buildHourlySeries(hourly)
    return buildDailySeries(daily, range === '7d' ? 7 : 30)
  }, [hasAnyHistory, range, hourly, daily])

  const rangeTotal = useMemo(
    () => series.reduce((sum, item) => sum + item.hits, 0),
    [series],
  )

  const maxValue = useMemo(() => {
    const peak = Math.max(...series.map((item) => item.hits), 0)
    if (peak <= 4) return Math.max(peak, 4)
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)))
    return Math.ceil(peak / magnitude) * magnitude
  }, [series])

  const plotWidth = Math.max(chartWidth - PAD_LEFT - PAD_RIGHT, 120)
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
  const baselineY = PAD_TOP + plotHeight

  const points = useMemo<ChartPoint[]>(() => {
    const count = series.length
    if (count === 0) return []
    return series.map((item, idx) => {
      const x = count === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (idx / (count - 1)) * plotWidth
      const ratio = maxValue > 0 ? item.hits / maxValue : 0
      const y = baselineY - ratio * plotHeight
      return {
        ...item,
        x,
        y,
      }
    })
  }, [series, plotWidth, plotHeight, baselineY, maxValue])

  // 按实际像素间距计算 X 轴标签步长，避免最右侧相邻刻度重叠
  const visibleLabelIndices = useMemo(() => {
    const count = points.length
    const shown = new Set<number>()
    if (count === 0) return shown
    if (count === 1) {
      shown.add(0)
      return shown
    }

    const minPxGap = chartWidth < 480 ? 64 : 78
    const maxLabels = Math.max(2, Math.floor(plotWidth / minPxGap) + 1)
    const step = Math.max(1, Math.ceil((count - 1) / (maxLabels - 1)))

    shown.add(0)
    for (let idx = step; idx < count - 1; idx += step) {
      if (points[count - 1].x - points[idx].x >= minPxGap * 0.72) {
        shown.add(idx)
      }
    }
    shown.add(count - 1)
    return shown
  }, [points, chartWidth, plotWidth])

  const activePoint = useMemo(() => {
    if (points.length === 0) return null
    if (hoveredKey) {
      const found = points.find((pt) => pt.key === hoveredKey)
      if (found) return found
    }
    return points[points.length - 1]
  }, [points, hoveredKey])

  const linePath = useMemo(() => buildSmoothLinePath(points), [points])
  const areaPath = useMemo(() => {
    if (points.length === 0) return ''
    const first = points[0]
    const last = points[points.length - 1]
    return `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
  }, [linePath, points, baselineY])

  const yTicks = [0, Math.round(maxValue / 2), maxValue]

  const metaNote =
    range === '24h'
      ? rangeTotal === 0 && daily.length > 0
        ? '小时级数据实时采集中，可切 7 天 / 30 天查看历史'
        : '按小时实时聚合 · 本地时区'
      : 'Cloudflare KV 按日汇总'

  return (
    <LayerCard className="overflow-hidden">
      <LayerCard.Secondary className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="text-body-semibold text-text-primary">转换请求趋势</h2>
          <span className="text-headline-semibold tracking-[-0.015em] tabular-nums text-text-primary">
            {loading ? '—' : formatCount(rangeTotal)}
          </span>
          <span className="text-caption-1-regular tabular-nums text-text-tertiary">
            {RANGE_SUMMARY_LABEL[range]}
          </span>
        </div>

        <Tabs
          variant="segmented"
          size="sm"
          tabs={RANGE_TABS}
          value={range}
          onValueChange={(next) => {
            setRange(next as RangeKey)
            setHoveredKey(null)
          }}
        />
      </LayerCard.Secondary>

      <LayerCard.Primary className="p-4 sm:p-5">
        {loading ? (
          <Skeleton className="h-[228px] w-full rounded-lg" />
        ) : series.length === 0 ? (
          <div className="flex h-[204px] items-center justify-center rounded-lg border border-dashed border-separator-border bg-background-secondary-default/40 text-body-2-regular text-text-tertiary">
            暂无趋势数据，完成首次订阅转换后将自动生成曲线
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-body-2-regular tabular-nums">
              {activePoint ? (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-body-2-semibold text-text-primary">
                    <span className="size-2 rounded-full bg-accent-500" aria-hidden />
                    {activePoint.readoutLabel}
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
                <span className="text-text-tertiary">移动或轻触查看时段明细</span>
              )}
              <span className="hidden text-caption-1-regular text-text-tertiary sm:inline">
                {metaNote}
              </span>
            </div>

            <div ref={setContainerEl} className="w-full" dir="ltr">
              <svg
                viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
                width="100%"
                height={CHART_HEIGHT}
                className="block h-[204px] w-full overflow-visible select-none"
                role="img"
                aria-label={`${RANGE_SUMMARY_LABEL[range]}趋势图`}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Horizontal gridlines + Y-axis labels */}
                {yTicks.map((tick) => {
                  const y = baselineY - (maxValue > 0 ? (tick / maxValue) * plotHeight : 0)
                  return (
                    <g key={tick}>
                      <line
                        x1={PAD_LEFT}
                        x2={chartWidth - PAD_RIGHT}
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
                        fontSize={11}
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
                      r={6.5}
                      fill="var(--color-accent-500)"
                      fillOpacity={0.18}
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r={3.5}
                      fill="var(--color-background-primary-default)"
                      stroke="var(--color-accent-500)"
                      strokeWidth={2}
                    />
                  </g>
                ) : null}

                {/* X-axis labels */}
                {points.map((pt, idx) => {
                  if (!visibleLabelIndices.has(idx)) return null
                  const isActive = activePoint?.key === pt.key
                  return (
                    <text
                      key={pt.key}
                      x={pt.x}
                      y={CHART_HEIGHT - 6}
                      textAnchor={
                        idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'
                      }
                      fill={isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'}
                      fontWeight={isActive ? 500 : 400}
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                    >
                      {pt.tickLabel}
                    </text>
                  )
                })}

                {/* Interactive hover & touch slices */}
                {points.map((pt, idx) => {
                  const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth
                  const sliceX = Math.max(PAD_LEFT, pt.x - step / 2)
                  const sliceWidth = idx === 0 || idx === points.length - 1 ? step / 2 : step
                  return (
                    <rect
                      key={`hit-${pt.key}`}
                      x={sliceX}
                      y={PAD_TOP}
                      width={Math.max(sliceWidth, 8)}
                      height={plotHeight + PAD_BOTTOM}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredKey(pt.key)}
                      onPointerDown={() => setHoveredKey(pt.key)}
                      onFocus={() => setHoveredKey(pt.key)}
                      tabIndex={0}
                      aria-label={`${pt.readoutLabel}：${pt.hits} 次转换`}
                    />
                  )
                })}
              </svg>
            </div>

            <table className="sr-only">
              <caption>{RANGE_SUMMARY_LABEL[range]}明细</caption>
              <thead>
                <tr>
                  <th scope="col">{range === '24h' ? '时段' : '日期'}</th>
                  <th scope="col">转换次数</th>
                  <th scope="col">活跃订阅</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => (
                  <tr key={item.key}>
                    <td>{item.readoutLabel}</td>
                    <td>{item.hits}</td>
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
