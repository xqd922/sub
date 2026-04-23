import { Button, Layout, Menu, Space, Tag, Typography } from '@arco-design/web-react'
import {
  IconCheckCircle,
  IconCloud,
  IconDashboard,
  IconLink,
  IconPoweroff,
  IconSafe,
  IconSettings,
  IconSubscribe,
  IconSync
} from '@arco-design/web-react/icon'
import type { AdminSection } from '../types'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface AdminLayoutProps {
  children: React.ReactNode
  activeSection: AdminSection
  autoRefresh: boolean
  onNavigate: (section: AdminSection) => void
  onLogout: () => void
}

const menuItems: Array<{ key: AdminSection; label: string; icon: React.ReactNode }> = [
  { key: 'overview', label: '总览', icon: <IconDashboard /> },
  { key: 'subscriptions', label: '订阅记录', icon: <IconSubscribe /> },
  { key: 'shortlinks', label: '短链接', icon: <IconLink /> },
  { key: 'diagnostics', label: '运行诊断', icon: <IconSafe /> },
  { key: 'settings', label: '设置', icon: <IconSettings /> }
]

export function AdminLayout({
  children,
  activeSection,
  autoRefresh,
  onNavigate,
  onLogout
}: AdminLayoutProps) {
  return (
    <Layout className="admin-shell admin-root">
      <Sider className="admin-sider" width={232} breakpoint="lg" collapsible>
        <div className="admin-brand">
          <div className="admin-brand-mark">S</div>
          <div>
            <div className="admin-brand-title">SubOps</div>
            <Text className="admin-brand-subtitle">订阅转换管理</Text>
          </div>
        </div>

        <Menu
          className="admin-menu"
          selectedKeys={[activeSection]}
          onClickMenuItem={(key) => onNavigate(key as AdminSection)}
        >
          {menuItems.map((item) => (
            <Menu.Item key={item.key}>
              {item.icon}
              {item.label}
            </Menu.Item>
          ))}
        </Menu>
      </Sider>

      <Layout className="admin-main-layout">
        <Header className="admin-topbar">
          <div>
            <Text className="admin-eyebrow">ARCO CONTROL PLANE</Text>
            <h1 className="admin-title">订阅服务管理控制台</h1>
          </div>

          <Space size={12} wrap>
            <Tag icon={<IconCloud />} color="arcoblue" className="status-pill">KV Online</Tag>
            <Tag icon={<IconCheckCircle />} color="green" className="status-pill">Edge Runtime</Tag>
            <Tag icon={<IconSync />} color={autoRefresh ? 'cyan' : 'gray'} className="status-pill">
              {autoRefresh ? '自动刷新' : '手动刷新'}
            </Tag>
            <Button icon={<IconPoweroff />} type="secondary" status="danger" onClick={onLogout}>
              退出登录
            </Button>
          </Space>
        </Header>

        <Content className="admin-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
