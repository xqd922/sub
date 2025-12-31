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

  const cards = [
    { label: '总记录数', value: stats.totalRecords, color: 'text-blue-600' },
    { label: '总访问次数', value: stats.totalHits, color: 'text-green-600' },
    { label: '短链接数', value: shortLinksCount, color: 'text-purple-600' },
    { label: '活跃记录(7天)', value: stats.activeRecords, color: 'text-orange-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className={`text-3xl font-bold ${card.color}`}>
            {formatNumber(card.value)}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-sm">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
