import { Card, Skeleton, Tag } from '@heroui/react'
import type { Stats } from '../types'

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
  shortLinksCount: number
}

export function StatsCards({ stats, loading, shortLinksCount }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <div className="p-4">
              <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      value: stats.totalRecords,
      label: '总记录数',
      color: 'text-primary',
      trend: stats.todayNewRecords ? `+${stats.todayNewRecords}` : undefined
    },
    {
      value: stats.totalHits,
      label: '总访问次数',
      color: 'text-success',
      trend: stats.todayHits ? `今日 ${stats.todayHits}` : undefined
    },
    {
      value: shortLinksCount,
      label: '短链接数',
      color: 'text-secondary'
    },
    {
      value: stats.activeRecords,
      label: '活跃记录',
      color: 'text-warning'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className={`text-3xl font-bold ${card.color}`}>
                {card.value}
              </div>
              {card.trend && (
                <Tag className="bg-success/10 text-success text-xs">
                  {card.trend}
                </Tag>
              )}
            </div>
            <div className="text-default-500 text-sm mt-1">
              {card.label}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
