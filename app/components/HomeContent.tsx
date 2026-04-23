'use client'

import { Alert, Card, ConfigProvider, Grid, Space, Tag, Typography } from '@arco-design/web-react'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import {
  IconCloud,
  IconCode,
  IconDashboard,
  IconLink,
  IconSafe,
  IconSync
} from '@arco-design/web-react/icon'
import { useUrlConverter } from '../hooks/useUrlConverter'
import { useShortUrl } from '../hooks/useShortUrl'
import UrlInput from './ui/UrlInput'
import ResultItem from './ui/ResultItem'
import ShortUrlGenerator from './ui/ShortUrlGenerator'
import './home.css'

const { Row, Col } = Grid
const { Text } = Typography

const capabilities = [
  {
    title: '自动识别客户端',
    description: '根据请求端自动输出 Clash、Sing-box、v2rayNG 或 HTML 预览。',
    icon: <IconSync />
  },
  {
    title: 'Edge Runtime',
    description: '转换、记录和短链链路保持边缘运行，适合轻量高频访问。',
    icon: <IconCloud />
  },
  {
    title: '安全可观测',
    description: '敏感配置保留在环境变量，访问记录进入管理端统一查看。',
    icon: <IconSafe />
  }
]

export default function HomeContent() {
  const {
    inputUrl,
    setInputUrl,
    loading,
    error,
    convertedUrl,
    handleConvert,
    handleCopy
  } = useUrlConverter()

  const {
    shortUrl,
    shortenLoading,
    generateShortUrl,
    setShortUrl
  } = useShortUrl()

  const handleConvertClick = async () => {
    setShortUrl('')
    await handleConvert()
  }

  const handleGenerateShortUrl = () => {
    generateShortUrl(convertedUrl)
  }

  const handleCopyShortUrl = () => {
    handleCopy(shortUrl)
  }

  const handleCopyConvertedUrl = () => {
    handleCopy(convertedUrl)
  }

  return (
    <ConfigProvider locale={zhCN} size="default">
      <main className="public-root">
        <header className="public-topbar">
          <div className="public-brand">
            <div className="public-brand-mark">S</div>
            <div>
              <div className="public-brand-title">SubOps</div>
              <Text className="public-brand-subtitle">订阅转换入口</Text>
            </div>
          </div>

          <Space size={10} wrap>
            <Tag icon={<IconCloud />} color="arcoblue" className="public-status-pill">Edge Ready</Tag>
            <Tag icon={<IconLink />} color="green" className="public-status-pill">Short Link</Tag>
            <a className="public-admin-link" href="/admin">
              <IconDashboard />
              管理面板
            </a>
          </Space>
        </header>

        <section className="public-hero">
          <div className="public-hero-copy">
            <Text className="public-eyebrow">ARCO SERVICE GATEWAY</Text>
            <h1>通用订阅转换工作台</h1>
            <p>
              将订阅地址或节点链接转换为客户端可直接使用的配置，并自动生成可管理、可复制、可追踪的访问链接。
            </p>

            <div className="public-hero-tags">
              <Tag color="arcoblue">清晰输入</Tag>
              <Tag color="cyan">一致输出</Tag>
              <Tag color="green">边缘运行</Tag>
            </div>
          </div>

          <Card className="converter-card" bordered={false}>
            <div className="converter-card-head">
              <div>
                <Text className="public-eyebrow">CONVERSION FLOW</Text>
                <h2>转换订阅</h2>
              </div>
              <span className="converter-head-icon"><IconCode /></span>
            </div>

            <Space direction="vertical" size={16} className="public-stack">
              <UrlInput
                value={inputUrl}
                onChange={setInputUrl}
                error={error}
              />

              <button
                onClick={handleConvertClick}
                disabled={loading}
                className="public-primary-button"
              >
                {loading && <span className="public-button-progress" />}
                <span>{loading ? '转换中...' : '生成订阅链接'}</span>
              </button>

              {convertedUrl ? (
                <div className="result-stack">
                  <ResultItem
                    title="订阅链接"
                    url={convertedUrl}
                    onCopy={handleCopyConvertedUrl}
                  />

                  <ShortUrlGenerator
                    hasConvertedUrl={!!convertedUrl}
                    shortUrl={shortUrl}
                    loading={shortenLoading}
                    onGenerate={handleGenerateShortUrl}
                    onCopy={handleCopyShortUrl}
                  />
                </div>
              ) : (
                <Alert
                  type="info"
                  content="输入订阅地址后，系统会先生成标准转换链接，并自动复制到剪贴板。"
                />
              )}
            </Space>
          </Card>
        </section>

        <Row gutter={[16, 16]} className="capability-grid">
          {capabilities.map((item) => (
            <Col key={item.title} xs={24} md={8}>
              <Card className="capability-card" bordered={false}>
                <span className="capability-icon">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </main>
    </ConfigProvider>
  )
}
