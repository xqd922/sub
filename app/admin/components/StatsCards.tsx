import { Card, Skeleton, Chip } from '@heroui/react'
import type { Stats } from '../types'

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
  shortLinksCount: number
}

const colorMap: Record<string, string> = {
  blue: 'var(--apple-blue)',
  green: 'var(--apple-green)',
  purple: 'var(--apple-purple)',
  orange: 'var(--apple-orange)'
}

export function StatsCards({ stats, loading, shortLinksCount }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <Card.Content className="p-6">
              <Skeleton className="h-10 w-20 mb-3 rounded-xl" />
              <Skeleton className="h-4 w-24 rounded-lg" />
            </Card.Content>
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
      color: 'blue',
      trend: stats.todayNewRecords ? `+${stats.todayNewRecords}` : undefined
    },
    {
      value: stats.totalHits,
      label: '总访问次数',
      color: 'green',
      trend: stats.todayHits ? `今日 ${stats.todayHits}` : undefined
    },
    {
      value: shortLinksCount,
      label: '短链接数',
      color: 'purple',
      trend: undefined
    },
    {
      value: stats.activeRecords,
      label: '活跃记录',
      color: 'orange',
      trend: undefined
    }
  ]

  return (
    <div className="stats-grid">
      {cards.map((card, index) => (
        <Card key={index} className="stat-card">
          <Card.Content className="p-6">
            <div className="flex items-start justify-between mb-2">
              <span
                className="text-4xl font-bold tracking-tight leading-none"
                style={{ color: colorMap[card.color] }}
              >
                {card.value}
              </span>
              {card.trend && (
                <Chip size="sm" color="success" variant="soft">
                  {card.trend}
                </Chip>
              )}
            </div>
            <span className="text-sm text-[var(--apple-text-secondary)]">
              {card.label}
            </span>
          </Card.Content>
        </Card>
      ))}
    </div>
  )
}
