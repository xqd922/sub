import { Alert, Card, Descriptions, Grid, Progress, Space, Statistic, Tag, Timeline, Typography } from '@arco-design/web-react'
import { IconCheckCircle, IconClockCircle, IconCloud, IconSafe, IconStorage, IconSync } from '@arco-design/web-react/icon'
import type { Stats, UnifiedItem } from '../types'
import { formatAdminDate } from '../utils/items'

const { Row, Col } = Grid
const { Text } = Typography

interface DiagnosticsPanelProps {
  stats: Stats | null
  recordsCount: number
  shortLinksCount: number
  recentItems: UnifiedItem[]
  autoRefresh: boolean
  dataLoading: boolean
  dataError: string
}

export function DiagnosticsPanel({
  stats,
  recordsCount,
  shortLinksCount,
  recentItems,
  autoRefresh,
  dataLoading,
  dataError
}: DiagnosticsPanelProps) {
  const totalResources = recordsCount + shortLinksCount
  const activeRatio = stats && stats.totalRecords > 0
    ? Math.round((stats.activeRecords / stats.totalRecords) * 100)
    : 0

  const healthItems = [
    {
      title: '管理 API',
      status: dataError ? '异常' : '正常',
      color: dataError ? 'red' : 'green',
      icon: <IconSafe />,
      description: dataError || '记录、统计和短链接口可正常访问。'
    },
    {
      title: 'KV 数据层',
      status: totalResources > 0 ? '已连接' : '待写入',
      color: totalResources > 0 ? 'green' : 'gray',
      icon: <IconStorage />,
      description: totalResources > 0 ? `当前管理 ${totalResources} 个资源。` : '暂无资源数据，首次转换后会写入记录。'
    },
    {
      title: 'Edge Runtime',
      status: '已启用',
      color: 'arcoblue',
      icon: <IconCloud />,
      description: '管理 API 与订阅转换接口保持 Edge Runtime 兼容。'
    },
    {
      title: '刷新策略',
      status: autoRefresh ? '自动' : '手动',
      color: autoRefresh ? 'cyan' : 'gray',
      icon: <IconSync />,
      description: autoRefresh ? '每 30 秒自动同步一次管理数据。' : '当前仅在手动点击刷新时同步数据。'
    }
  ]

  return (
    <Space direction="vertical" size={16} className="admin-section-stack">
      {dataError && (
        <Alert type="error" content={dataError} />
      )}

      <Row gutter={[16, 16]}>
        {healthItems.map((item) => (
          <Col key={item.title} xs={24} md={12} xl={6}>
            <Card className="ops-card health-card" bordered>
              <div className="health-card-head">
                <span className="health-icon">{item.icon}</span>
                <Tag color={item.color}>{item.status}</Tag>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="ops-card" title="资源活跃度" bordered>
            <Progress
              type="circle"
              percent={activeRatio}
              color={activeRatio > 70 ? '#00b42a' : activeRatio > 30 ? '#ff7d00' : '#86909c'}
              formatText={() => `${activeRatio}%`}
            />
            <p className="diagnostic-copy">
              最近 7 天活跃订阅 {stats?.activeRecords ?? 0} 个，总订阅 {stats?.totalRecords ?? recordsCount} 个。
            </p>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="ops-card" title="数据规模" bordered>
            <Space direction="vertical" size={14} className="full-width">
              <Statistic title="订阅记录" value={recordsCount} groupSeparator />
              <Statistic title="短链接" value={shortLinksCount} groupSeparator />
              <Statistic title="累计访问" value={stats?.totalHits ?? 0} groupSeparator />
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="ops-card" title="同步状态" bordered>
            <Descriptions
              column={1}
              data={[
                { label: '数据状态', value: <Tag color={dataLoading ? 'orange' : 'green'}>{dataLoading ? '同步中' : '已同步'}</Tag> },
                { label: '自动刷新', value: autoRefresh ? '开启' : '关闭' },
                { label: '刷新周期', value: '30 秒' },
                { label: '资源总数', value: totalResources }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card className="ops-card" title="最近访问轨迹" bordered>
        {recentItems.length > 0 ? (
          <Timeline>
            {recentItems.map((item) => (
              <Timeline.Item key={`${item.type}-${item.id}`} dot={<IconClockCircle />} label={formatAdminDate(item.lastAccess)}>
                <Text bold>{item.name}</Text>
                <div>
                  <Text type="secondary">
                    {item.type === 'convert' ? '订阅转换' : '短链跳转'} · {item.hits.toLocaleString()} 次访问
                  </Text>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Text type="secondary">暂无访问轨迹。</Text>
        )}
      </Card>
    </Space>
  )
}
