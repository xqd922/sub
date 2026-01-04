'use client'

import { formatNumber } from '../utils/formatters'

interface Stats {
  totalRecords: number
  totalHits: number
  todayHits: number
  activeRecords: number
}

interface StatsCardsProps {
  stats: Stats | null
  shortLinksCount: number
}

export function StatsCards({ stats, shortLinksCount }: StatsCardsProps) {
  if (!stats) return null

  const items = [
    { label: '记录', value: stats.totalRecords },
    { label: '访问', value: stats.totalHits },
    { label: '今日', value: stats.todayHits },
    { label: '活跃', value: stats.activeRecords },
    { label: '短链', value: shortLinksCount },
  ]

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
        >
          <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">
            {formatNumber(item.value)}
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}
