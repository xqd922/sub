import { Button, Card, Grid, Input, Select, Space, Switch, Typography } from '@arco-design/web-react'
import { IconRefresh, IconSearch } from '@arco-design/web-react/icon'

const { Row, Col } = Grid
const { Text } = Typography

interface AdminToolbarProps {
  searchValue: string
  autoRefresh: boolean
  loading: boolean
  onSearchChange: (value: string) => void
  onAutoRefreshChange: (enabled: boolean) => void
  onRefresh: () => void | Promise<void>
}

export function AdminToolbar({
  searchValue,
  autoRefresh,
  loading,
  onSearchChange,
  onAutoRefreshChange,
  onRefresh
}: AdminToolbarProps) {
  return (
    <Card className="admin-toolbar-card" bordered>
      <Row gutter={[12, 12]} align="center">
        <Col xs={24} md={12} lg={14}>
          <Input
            allowClear
            value={searchValue}
            prefix={<IconSearch />}
            placeholder="搜索订阅名称、短链或原始 URL"
            onChange={onSearchChange}
          />
        </Col>

        <Col xs={24} md={12} lg={10}>
          <Space className="toolbar-actions" size={12} wrap>
            <Select value="all" disabled style={{ width: 132 }}>
              <Select.Option value="all">全部资源</Select.Option>
            </Select>

            <Space size={8}>
              <Switch checked={autoRefresh} onChange={onAutoRefreshChange} />
              <Text className="toolbar-muted">自动刷新</Text>
            </Space>

            <Button
              type="primary"
              icon={<IconRefresh />}
              loading={loading}
              onClick={() => void onRefresh()}
            >
              刷新数据
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}
