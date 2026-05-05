import { Alert, Button, Card, ConfigProvider, Grid, Input, Message, Modal, Space, Spin, Statistic, Table, Tag, Typography } from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import { useMemo, useState } from "react";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "./useAuth";
import { useAdminData } from "./useAdminData";
import type { UnifiedItem } from "./types";
import { buildAdminItems, buildShareLink, formatAdminDate, formatCompactUrl } from "./utils";

const { Row, Col } = Grid;
const { Title, Text, Paragraph } = Typography;

export function AdminPage() {
  const { isAuthed, token, loading: authLoading, error: authError, login, logout } = useAuth();
  const { records, shortLinks, stats, loading, error, refetch, deleteRecord, deleteShortLink } = useAdminData(token);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<UnifiedItem | null>(null);

  const items = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const all = buildAdminItems(records, shortLinks).sort((a, b) => b.lastAccess - a.lastAccess);
    if (!keyword) return all;
    return all.filter((item) => `${item.name} ${item.url} ${item.clientType ?? ""}`.toLowerCase().includes(keyword));
  }, [records, search, shortLinks]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      Message.success("已复制到剪贴板");
    } catch {
      Message.error("复制失败");
    }
  };

  const remove = async (item: UnifiedItem) => {
    const ok = item.type === "convert" ? await deleteRecord(item.id) : await deleteShortLink(item.id);
    if (ok) Message.success("删除成功");
    else Message.error("删除失败");
  };

  const columns: TableColumnProps<UnifiedItem>[] = [
    {
      title: "名称",
      dataIndex: "name",
      render: (_, item) => (
        <Space direction="vertical" size={2}>
          <Text bold>{item.name}</Text>
          <Text type="secondary" className="admin-url-text">{formatCompactUrl(item.url)}</Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      render: (_, item) => <Tag color={item.type === "convert" ? "arcoblue" : "green"}>{item.type === "convert" ? "订阅" : "短链"}</Tag>,
    },
    { title: "访问", dataIndex: "hits", sorter: (a, b) => a.hits - b.hits },
    {
      title: "最近访问",
      dataIndex: "lastAccess",
      render: (_, item) => formatAdminDate(item.lastAccess),
      sorter: (a, b) => a.lastAccess - b.lastAccess,
    },
    {
      title: "操作",
      render: (_, item) => (
        <Space wrap>
          <Button size="mini" onClick={() => setDetail(item)}>详情</Button>
          <Button size="mini" onClick={() => void copy(buildShareLink(item))}>复制</Button>
          <Button size="mini" status="danger" onClick={() => void remove(item)}>删除</Button>
        </Space>
      ),
    },
  ];

  if (!isAuthed) {
    return (
      <ConfigProvider locale={zhCN} size="default">
        <main className="admin-login-root">
          <section className="admin-login-hero">
            <BrandMark className="login-hero-icon" />
            <Title heading={1}>SubOps Admin</Title>
            <Paragraph>管理 Cloudflare Worker 上的订阅转换记录、短链接和运行统计。</Paragraph>
          </section>
          <Card className="admin-login-card" bordered={false}>
            <Title heading={3}>Login to Admin</Title>
            {authError && <Alert type="error" content={authError} />}
            <Input value={username} onChange={setUsername} placeholder="用户名" autoComplete="username" disabled={authLoading} />
            <Input.Password
              value={password}
              onChange={setPassword}
              placeholder="密码"
              autoComplete="current-password"
              disabled={authLoading}
              onPressEnter={() => void login(username, password)}
            />
            <Button type="primary" long loading={authLoading} onClick={() => void login(username, password)}>
              登录
            </Button>
          </Card>
        </main>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN} size="default">
      <main className="admin-root">
        <aside className="admin-sidebar">
          <a className="public-brand" href="/">
            <BrandMark />
            <span>SubOps</span>
          </a>
          <div className="admin-nav-card">
            <Text type="secondary">Cloudflare Native Console</Text>
            <Button long onClick={() => void refetch()} loading={loading}>刷新数据</Button>
            <Button long onClick={logout}>退出登录</Button>
          </div>
        </aside>

        <section className="admin-content">
          <div className="admin-header">
            <div>
              <Title heading={2}>控制台</Title>
              <Text type="secondary">订阅、短链和访问统计</Text>
            </div>
            <Input.Search className="admin-search" value={search} onChange={setSearch} placeholder="搜索名称、URL 或客户端" />
          </div>

          {error && <Alert className="admin-error" type="error" content={error} />}

          <Row gutter={[16, 16]} className="stats-row">
            <Col xs={12} md={6}><Card bordered={false}><Statistic title="总记录" value={stats?.totalRecords ?? 0} /></Card></Col>
            <Col xs={12} md={6}><Card bordered={false}><Statistic title="总访问" value={stats?.totalHits ?? 0} /></Card></Col>
            <Col xs={12} md={6}><Card bordered={false}><Statistic title="今日访问" value={stats?.todayHits ?? 0} /></Card></Col>
            <Col xs={12} md={6}><Card bordered={false}><Statistic title="短链接" value={shortLinks.length} /></Card></Col>
          </Row>

          <Card className="admin-table-card" bordered={false}>
            <Spin loading={loading}>
              <Table rowKey={(item) => `${item.type}-${item.id}`} columns={columns} data={items} pagination={{ pageSize: 10 }} />
            </Spin>
          </Card>
        </section>

        <Modal title="资源详情" visible={Boolean(detail)} onCancel={() => setDetail(null)} footer={null} unmountOnExit>
          {detail && (
            <Space direction="vertical" size={12} className="full-width">
              <Text bold>{detail.name}</Text>
              <Tag color={detail.type === "convert" ? "arcoblue" : "green"}>{detail.type}</Tag>
              <code className="result-value">{detail.url}</code>
              <Text>访问次数：{detail.hits}</Text>
              <Text>最近访问：{formatAdminDate(detail.lastAccess)}</Text>
              {detail.clientType && <Text>客户端：{detail.clientType}</Text>}
              {detail.nodeCount !== undefined && <Text>节点数：{detail.nodeCount}</Text>}
              <Button type="primary" onClick={() => void copy(buildShareLink(detail))}>复制分享链接</Button>
            </Space>
          )}
        </Modal>
      </main>
    </ConfigProvider>
  );
}
