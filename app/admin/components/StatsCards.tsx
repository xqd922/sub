import type { Stats } from '../types'

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
  shortLinksCount: number
}

export function StatsCards({ stats, loading, shortLinksCount }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ height: 40, width: 80, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: 100 }} />
          </div>
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
        <div key={index} className="stat-card">
          <div className="stat-card-header">
            <span className={`stat-value ${card.color}`}>
              {card.value}
            </span>
            {card.trend && (
              <span className="stat-trend">{card.trend}</span>
            )}
          </div>
          <span className="stat-label">{card.label}</span>
        </div>
      ))}
    </div>
  )
}
