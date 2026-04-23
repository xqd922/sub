import { Alert, Card, Descriptions, Grid, Space, Tag, Typography } from '@arco-design/web-react'
import { IconCheckCircle, IconLock, IconSafe, IconStorage } from '@arco-design/web-react/icon'

const { Row, Col } = Grid
const { Paragraph, Text } = Typography

interface SettingsPanelProps {
  autoRefresh: boolean
  token: string
}

export function SettingsPanel({ autoRefresh, token }: SettingsPanelProps) {
  const maskedToken = token ? `${token.slice(0, 10)}...${token.slice(-6)}` : '未登录'

  return (
    <Space direction="vertical" size={16} className="admin-section-stack">
      <Alert
        type="info"
        content="敏感配置通过环境变量管理。当前页面只展示配置项状态，不直接暴露密码或完整 token。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="ops-card" title="认证配置" bordered>
            <Descriptions
              column={1}
              data={[
                { label: '默认用户名', value: 'ADMIN_USERNAME，未配置时为 admin' },
                { label: '管理员密码', value: <Tag color="green" icon={<IconCheckCircle />}>通过 ADMIN_PASSWORD 配置</Tag> },
                { label: '会话 Token', value: maskedToken },
                { label: '认证方式', value: 'Bearer token / Session token' }
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="ops-card" title="运行配置" bordered>
            <Descriptions
              column={1}
              data={[
                { label: '运行时', value: <Tag color="arcoblue">Edge Runtime</Tag> },
                { label: '数据存储', value: <Tag color="arcoblue" icon={<IconStorage />}>Cloudflare KV / Local Mock</Tag> },
                { label: '自动刷新', value: autoRefresh ? '开启' : '关闭' },
                { label: '短链服务', value: 'KV → TinyURL → Sink → Bitly 降级链路' }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="ops-card" title="本地开发环境" bordered>
            <Paragraph className="settings-code-block">
              ADMIN_USERNAME=admin<br />
              ADMIN_PASSWORD=your_password
            </Paragraph>
            <Text type="secondary">
              本地使用 .env.local 配置，文件已被 .gitignore 忽略，不会提交到仓库。
            </Text>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="ops-card" title="安全建议" bordered>
            <Space direction="vertical" size={10}>
              <div className="security-tip"><IconLock /> 生产环境必须设置强密码。</div>
              <div className="security-tip"><IconSafe /> 不要将 .env.local、token 或 KV 凭据提交到 Git。</div>
              <div className="security-tip"><IconCheckCircle /> 修改 ADMIN_PASSWORD 后，旧登录 token 会自然失效。</div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
