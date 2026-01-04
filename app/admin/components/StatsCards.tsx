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

interface StatCardConfig {
  label: string
  value: number
  icon: React.ReactNode
  gradient: string
  shadowColor: string
  subValue?: { value: number; label: string }
}

export function StatsCards({ stats, shortLinksCount }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 bg-gray-100 rounded-xl" />
            </div>
            <div className="mt-4 w-16 h-8 bg-gray-100 rounded-lg" />
            <div className="mt-2 w-20 h-4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const cards: StatCardConfig[] = [
    {
      label: '总记录数',
      value: stats.totalRecords,
      gradient: 'from-cyan-400 to-blue-500',
      shadowColor: 'shadow-cyan-500/20',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      label: '总访问次数',
      value: stats.totalHits,
      gradient: 'from-green-400 to-emerald-500',
      shadowColor: 'shadow-green-500/20',
      subValue: stats.todayHits > 0 ? { value: stats.todayHits, label: '今日' } : undefined,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    {
      label: '短链接数',
      value: shortLinksCount,
      gradient: 'from-purple-400 to-pink-500',
      shadowColor: 'shadow-purple-500/20',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      label: '活跃记录',
      value: stats.activeRecords,
      gradient: 'from-orange-400 to-amber-500',
      shadowColor: 'shadow-orange-500/20',
      subValue: { value: 7, label: '天内' },
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      )
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          {/* 头部：图标 */}
          <div className="flex items-start justify-between">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient}
                            flex items-center justify-center text-white
                            shadow-lg ${card.shadowColor}`}>
              {card.icon}
            </div>
            {card.subValue && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                              bg-gray-50 text-xs text-gray-500">
                <span className="text-green-500 font-medium">+{card.subValue.value}</span>
                <span>{card.subValue.label}</span>
              </span>
            )}
          </div>

          {/* 数值 */}
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-800 tracking-tight">
              {formatNumber(card.value)}
            </div>
          </div>

          {/* 标签 */}
          <div className="mt-1 text-sm text-gray-400">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  )
}
