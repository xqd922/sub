import { Card, Grid, Skeleton, Statistic, Tag, Typography } from '@arco-design/web-react'
import type { Stats } from '../types'

const { Row, Col } = Grid
const { Text } = Typography

interface StatsCardsProps {
  stats: Stats | null
  loading: boolean
  shortLinksCount: number
}

const metricCards = [
  { key: 'todayHits', title: '今日访问', color: 'arcoblue', suffix: 'hits' },
  { key: 'totalHits', title: '累计访问', color: 'green', suffix: 'hits' },
  { key: 'totalRecords', title: '订阅记录', color: 'purple', suffix: 'records' },
  { key: 'activeRecords', title: '活跃订阅', color: 'orange', suffix: 'active' }
] as const

export function StatsCards({ stats, loading, shortLinksCount }: StatsCardsProps) {
  if (loading) {
    return (
      <Row gutter={[16, 16]} className="metrics-grid">
        {[1, 2, 3, 4].map((item) => (
          <Col key={item} xs={24} sm={12} lg={6}>
            <Card className="metric-card" bordered>
              <Skeleton text={{ rows: 2 }} animation />
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  if (!stats) return null

  const values = {
    todayHits: stats.todayHits,
    totalHits: stats.totalHits,
    totalRecords: stats.totalRecords,
    activeRecords: stats.activeRecords
  }

  return (
    <Row gutter={[16, 16]} className="metrics-grid">
      {metricCards.map((card) => (
        <Col key={card.key} xs={24} sm={12} lg={6}>
          <Card className="metric-card" bordered>
            <div className="metric-card-header">
              <Text className="metric-label">{card.title}</Text>
              <Tag color={card.color}>{card.suffix}</Tag>
            </div>
            <Statistic
              className="metric-value"
              value={values[card.key]}
              groupSeparator
            />
          </Card>
        </Col>
      ))}

      <Col xs={24} sm={12} lg={6} className="hidden-metric-col">
        <Card className="metric-card" bordered>
          <div className="metric-card-header">
            <Text className="metric-label">短链资产</Text>
            <Tag color="cyan">links</Tag>
          </div>
          <Statistic className="metric-value" value={shortLinksCount} groupSeparator />
        </Card>
      </Col>
    </Row>
  )
}
