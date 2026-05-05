import { Alert, Button, Card, ConfigProvider, Grid, Space, Tag, Typography } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { AdminPage } from "./admin/AdminPage";
import { BrandMark } from "./components/BrandMark";
import { ResultItem } from "./components/ResultItem";
import { ShortUrlGenerator } from "./components/ShortUrlGenerator";
import { UrlInput } from "./components/UrlInput";
import { useClipboard } from "./hooks/useClipboard";
import { useShortUrl } from "./hooks/useShortUrl";
import { useToast } from "./hooks/useToast";
import { useUrlConverter } from "./hooks/useUrlConverter";

const { Row, Col } = Grid;
const { Title, Paragraph, Text } = Typography;

export function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  const { toasts, showToast } = useToast();
  const copy = useClipboard(
    (message) => showToast(message, "success"),
    (message) => showToast(message, "error"),
  );
  const { inputUrl, setInputUrl, loading, error, convertedUrl, handleConvert } = useUrlConverter();
  const { shortUrl, shortLoading, shortError, generateShortUrl } = useShortUrl();

  return (
    <ConfigProvider locale={zhCN} size="default">
      <main className="public-root">
        <div className="public-shell">
          <nav className="public-topbar">
            <a className="public-brand" href="/" aria-label="Sub Converter">
              <BrandMark />
              <span>Sub Converter</span>
            </a>
            <Space size={12}>
              <Tag color="arcoblue">Cloudflare Native</Tag>
              <a className="admin-link" href="/admin">Admin</a>
            </Space>
          </nav>

          <section className="public-hero">
            <div className="hero-copy">
              <Tag color="green" className="hero-kicker">Worker + KV + Static Assets</Tag>
              <Title heading={1}>订阅转换，运行在 Cloudflare 原生边缘网络。</Title>
              <Paragraph>
                自动识别 Clash、sing-box、v2rayNG 和浏览器访问方式，输出对应格式并记录转换历史。
              </Paragraph>
              <Space wrap>
                <Tag>Clash YAML</Tag>
                <Tag>sing-box JSON</Tag>
                <Tag>v2rayNG Base64</Tag>
                <Tag>Gist Merge</Tag>
              </Space>
            </div>

            <Card className="converter-card" bordered={false}>
              <UrlInput value={inputUrl} onChange={setInputUrl} error={error} />
              <Button
                type="primary"
                size="large"
                loading={loading}
                className="public-primary-button"
                onClick={handleConvert}
              >
                生成转换链接
              </Button>

              {convertedUrl && (
                <div className="result-stack">
                  <ResultItem
                    title="转换链接"
                    description="客户端订阅此地址即可按 User-Agent 自动获得匹配配置。"
                    value={convertedUrl}
                    onCopy={() => copy(convertedUrl, "转换链接已复制")}
                  />
                  <ShortUrlGenerator
                    convertedUrl={convertedUrl}
                    shortUrl={shortUrl}
                    loading={shortLoading}
                    error={shortError}
                    onGenerate={() => generateShortUrl(convertedUrl)}
                    onCopy={() => copy(shortUrl, "短链接已复制")}
                  />
                </div>
              )}
            </Card>
          </section>

          <Row gutter={[20, 20]} className="feature-grid">
            <Col xs={24} md={8}>
              <Card className="feature-card" bordered={false}>
                <Text className="feature-title">协议覆盖</Text>
                <Paragraph>支持 Shadowsocks、VMess、VLESS、Trojan、Hysteria2、SOCKS 和 AnyTLS。</Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" bordered={false}>
                <Text className="feature-title">智能整理</Text>
                <Paragraph>自动去重、地区识别、倍率提取和节点重命名，适合多源订阅合并。</Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" bordered={false}>
                <Text className="feature-title">边缘存储</Text>
                <Paragraph>短链接、转换记录和统计数据直接写入 Cloudflare KV。</Paragraph>
              </Card>
            </Col>
          </Row>

          <Alert
            className="public-note"
            type="info"
            content="浏览器打开转换链接会显示预览页；订阅客户端访问会直接返回对应配置文件。"
          />
        </div>

        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </main>
    </ConfigProvider>
  );
}
