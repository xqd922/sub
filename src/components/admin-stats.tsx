'use client'

import { useMemo } from 'react'
import type { ConvertRecord } from '@/infra/kv/types'
import { useAdminStats, useAdminRecords, useAutoRefresh } from '@/components/use-admin-data'

interface AdminStatsProps {
  autoRefresh: boolean
}

function formatNumber(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

export default function AdminStats({ autoRefresh }: AdminStatsProps) {
  const { stats, daily, loading, refresh } = useAdminStats()
  const { records } = useAdminRecords()

  useAutoRefresh(refresh, autoRefresh)

  const clientTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const record of records) {
      const type = record.clientType || 'unknown'
      counts.set(type, (counts.get(type) || 0) + record.hits)
    }
    return Array.from(counts.entries())
      .map(([type, hits]) => ({ type, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 6)
  }, [records])

  const topRecords = useMemo(() => (
    [...records].sort((a, b) => b.hits - a.hits).slice(0, 5)
  ), [records])

  const maxDaily = Math.max(...daily.map(item => item.totalHits), 1)
  const maxClientHits = Math.max(...clientTypes.map(item => item.hits), 1)
  const maxRecordHits = Math.max(...topRecords.map(item => item.hits), 1)

  const tiles = [
    { label: '总转换次数', value: stats ? formatNumber(stats.totalHits) : '—', hint: '全部记录累计' },
    { label: '今日转换', value: stats ? formatNumber(stats.todayHits) : '—', hint: '当天累计' },
    { label: '记录总数', value: stats ? formatNumber(stats.totalRecords) : '—', hint: '未含已禁用' },
    { label: '近 7 日活跃', value: stats ? formatNumber(stats.activeRecords) : '—', hint: '有访问的订阅' }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(tile => (
          <div
            key={tile.label}
            className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4"
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{tile.label}</p>
            <p className="text-xl sm:text-2xl font-light mt-1 text-gray-900 dark:text-white">{tile.value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">近 30 天转换趋势</h2>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">每日请求次数</span>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 py-8 text-center">加载中...</p>
        ) : daily.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">暂无数据，转换完成后这里会出现趋势图</p>
        ) : (
          <>
            <div className="flex items-end gap-[2px] h-32" role="img" aria-label={`近 ${daily.length} 天每日转换次数趋势`}>
              {daily.map((item, index) => (
                <div key={item.date} className="relative flex-1 h-full flex items-end group">
                  <div
                    className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-opacity group-hover:opacity-80"
                    style={{ height: `${Math.max((item.totalHits / maxDaily) * 100, item.totalHits > 0 ? 3 : 1)}%` }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                    <div className="whitespace-nowrap px-2 py-1 rounded-md bg-gray-900 dark:bg-gray-700 text-white text-[10px]">
                      {shortDate(item.date)} · {item.totalHits} 次 · {item.uniqueUrls} 个订阅
                    </div>
                  </div>
                  {(index % 5 === 0 || index === daily.length - 1) && (
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 dark:text-gray-500">
                      {shortDate(item.date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="h-5" aria-hidden="true" />

            <table className="sr-only">
              <caption>近 30 天每日转换次数</caption>
              <thead>
                <tr><th scope="col">日期</th><th scope="col">转换次数</th><th scope="col">订阅数</th></tr>
              </thead>
              <tbody>
                {daily.map(item => (
                  <tr key={item.date}>
                    <td>{item.date}</td><td>{item.totalHits}</td><td>{item.uniqueUrls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">客户端分布（按请求量）</h2>
          {clientTypes.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">暂无数据</p>
          ) : (
            <div className="space-y-2.5">
              {clientTypes.map(({ type, hits }) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-[10px] sm:text-xs text-gray-600 dark:text-gray-300" title={type}>
                    {type}
                  </span>
                  <div className="flex-1 h-2 bg-transparent">
                    <div
                      className="h-full rounded-r bg-blue-500/70 dark:bg-blue-400/70"
                      style={{ width: `${(hits / maxClientHits) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[10px] sm:text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {formatNumber(hits)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <h2 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">热门订阅 Top 5</h2>
          {topRecords.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">暂无数据</p>
          ) : (
            <ol className="space-y-2.5">
              {topRecords.map((record: ConvertRecord, index) => (
                <li key={record.id} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{index + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-[10px] sm:text-xs text-gray-600 dark:text-gray-300" title={record.name}>
                    {record.name}
                  </span>
                  <div className="w-16 sm:w-24 shrink-0 h-2">
                    <div
                      className="h-full rounded-r bg-blue-500/70 dark:bg-blue-400/70"
                      style={{ width: `${(record.hits / maxRecordHits) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[10px] sm:text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {formatNumber(record.hits)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
        统计基于 Cloudflare KV，跨节点同步存在分钟级延迟
      </p>
    </div>
  )
}
