'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Card,
  ConfigProvider,
  Grid,
  Message,
  Space,
  Tag,
  Timeline,
  Typography
} from '@arco-design/web-react'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import type { AdminSection, UnifiedItem } from './types'
import { useAuth } from './hooks/useAuth'
import { useAdminData } from './hooks/useAdminData'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useAutoRefresh } from './hooks/useAutoRefresh'
import { buildAdminItems, formatAdminDate } from './utils/items'
import { LoginForm } from './components/LoginForm'
import { AdminLayout } from './components/AdminLayout'
import { AdminToolbar } from './components/AdminToolbar'
import { StatsCards } from './components/StatsCards'
import { UnifiedTable } from './components/UnifiedTable'
import { DetailModal } from './components/DetailModal'
import './admin.css'

const { Row, Col } = Grid
const { Text } = Typography

export default function AdminPage() {
  const { isAuthed, token, loading: authLoading, error: authError, login, logout } = useAuth()
  const {
    records,
    shortLinks,
    stats,
    loading: dataLoading,
    error: dataError,
    refetch,
    deleteRecord,
    deleteShortLink
  } = useAdminData(token)

  const [activeSection, setActiveSection] = useState<AdminSection>('overview')
  const [searchInput, setSearchInput] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [detailItem, setDetailItem] = useState<UnifiedItem | null>(null)

  const searchTerm = useDebouncedValue(searchInput)
  const tableItems = useMemo(() => buildAdminItems(records, shortLinks), [records, shortLinks])

  const recentItems = useMemo(() => {
    return [...tableItems].sort((a, b) => b.lastAccess - a.lastAccess).slice(0, 5)
  }, [tableItems])

  const topItems = useMemo(() => {
    return [...tableItems].sort((a, b) => b.hits - a.hits).slice(0, 5)
  }, [tableItems])

  const clientStats = useMemo(() => {
    const result = new Map<string, number>()
    records.forEach((record) => {
      const key = record.clientType || 'unknown'
      result.set(key, (result.get(key) || 0) + 1)
    })
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [records])

  useAutoRefresh({
    enabled: autoRefresh,
    active: isAuthed,
    onRefresh: refetch
  })

  const handleLogout = useCallback(() => {
    logout()
    setSearchInput('')
    setDetailItem(null)
    setActiveSection('overview')
  }, [logout])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      Message.success('已复制到剪贴板')
    } catch {
      Message.error('复制失败')
    }
  }, [])

  const handleDelete = useCallback(async (item: UnifiedItem) => {
    const success = item.type === 'convert'
      ? await deleteRecord(item.id)
      : await deleteShortLink(item.id)

    if (success) {
      Message.success('删除成功')
      if (detailItem?.id === item.id && detailItem.type === item.type) {
        setDetailItem(null)
      }
    } else {
      Message.error('删除失败')
    }
  }, [deleteRecord, deleteShortLink, detailItem])

  if (authLoading && !isAuthed) {
    return (
      <ConfigProvider locale={zhCN} size="default">
        <div className="admin-login-screen admin-root">
          <Card className="admin-login-card auth-check-card" bordered>
            <div className="admin-login-brand">S</div>
            <h1 className="login-title">SubOps Console</h1>
            <Text className="login-subtitle">正在验证登录状态...</Text>
          </Card>
        </div>
      </ConfigProvider>
    )
  }

  if (!isAuthed) {
    return (
      <ConfigProvider locale={zhCN} size="default">
        <LoginForm onLogin={login} loading={authLoading} error={authError} />
      </ConfigProvider>
    )
  }

  const renderOverview = () => (
    <Space direction="vertical" size={20} className="admin-section-stack">
      <StatsCards stats={stats} loading={dataLoading} shortLinksCount={shortLinks.length} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="ops-card" title="客户端分布" bordered>
            {clientStats.length > 0 ? (
              <Space direction="vertical" size={10} className="full-width">
                {clientStats.map(([client, count]) => (
                  <div key={client} className="distribution-row">
                    <Text>{client}</Text>
                    <Space size={8}>
                      <div className="distribution-track">
                        <div
                          className="distribution-bar"
                          style={{ width: `${Math.max(12, (count / records.length) * 100)}%` }}
                        />
                      </div>
                      <Tag color="arcoblue">{count}</Tag>
                    </Space>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无客户端数据</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="ops-card" title="高访问资源" bordered>
            <Space direction="vertical" size={10} className="full-width">
              {topItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="rank-row">
                  <div>
                    <Text bold>{item.name}</Text>
                    <div><Text type="secondary">{item.type === 'convert' ? '订阅' : '短链'}</Text></div>
                  </div>
                  <Tag color="green">{item.hits.toLocaleString()}</Tag>
                </div>
              ))}
              {topItems.length === 0 && <Text type="secondary">暂无访问数据</Text>}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="ops-card" title="最近活动" bordered>
            <Timeline className="activity-timeline">
              {recentItems.map((item) => (
                <Timeline.Item key={`${item.type}-${item.id}`} label={formatAdminDate(item.lastAccess)}>
                  <Text>{item.name}</Text>
                  <div><Text type="secondary">{item.type === 'convert' ? '订阅访问' : '短链访问'}</Text></div>
                </Timeline.Item>
              ))}
              {recentItems.length === 0 && <Text type="secondary">暂无活动记录</Text>}
            </Timeline>
          </Card>
        </Col>
      </Row>
    </Space>
  )

  const renderDiagnostics = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card className="ops-card" title="KV 存储" bordered>
          <Tag color="green">Connected</Tag>
          <p className="diagnostic-copy">当前记录和短链通过 KV 层读取，管理接口响应正常。</p>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card className="ops-card" title="Edge Runtime" bordered>
          <Tag color="arcoblue">Enabled</Tag>
          <p className="diagnostic-copy">管理 API 和订阅转换接口保持 Edge Runtime 兼容。</p>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card className="ops-card" title="刷新策略" bordered>
          <Tag color={autoRefresh ? 'cyan' : 'gray'}>{autoRefresh ? 'Auto' : 'Manual'}</Tag>
          <p className="diagnostic-copy">自动刷新周期为 30 秒，适合低频运营监控。</p>
        </Card>
      </Col>
    </Row>
  )

  const renderContent = () => {
    if (activeSection === 'overview') return renderOverview()
    if (activeSection === 'diagnostics') return renderDiagnostics()
    if (activeSection === 'settings') {
      return (
        <Card className="ops-card" title="设置" bordered>
          <Text type="secondary">当前版本先保留运行配置展示，后续可加入管理密码、主题和清理策略。</Text>
        </Card>
      )
    }

    return (
      <Space direction="vertical" size={16} className="admin-section-stack">
        <AdminToolbar
          searchValue={searchInput}
          autoRefresh={autoRefresh}
          loading={dataLoading}
          onSearchChange={setSearchInput}
          onAutoRefreshChange={setAutoRefresh}
          onRefresh={refetch}
        />

        <UnifiedTable
          items={tableItems}
          recordsCount={records.length}
          shortLinksCount={shortLinks.length}
          loading={dataLoading}
          searchTerm={searchTerm}
          mode={activeSection === 'subscriptions' ? 'convert' : 'shortlink'}
          onDelete={handleDelete}
          onShowDetail={setDetailItem}
          onCopy={handleCopy}
        />
      </Space>
    )
  }

  return (
    <ConfigProvider locale={zhCN} size="default">
      <AdminLayout
        activeSection={activeSection}
        autoRefresh={autoRefresh}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
      >
        {dataError && (
          <Alert className="admin-error-banner" type="error" content={dataError} />
        )}

        {renderContent()}
      </AdminLayout>

      <DetailModal
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onCopy={handleCopy}
        item={detailItem}
      />
    </ConfigProvider>
  )
}
