import { Button, Empty, Popconfirm, Space, Table, Tag, Tooltip, Typography } from '@arco-design/web-react'
import { IconCopy, IconDelete, IconEye } from '@arco-design/web-react/icon'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import type { TypeFilter, UnifiedItem } from '../types'
import { buildShareLink, formatAdminDate, formatCompactUrl } from '../utils/items'

const { Text } = Typography

interface UnifiedTableProps {
  items: UnifiedItem[]
  loading: boolean
  recordsCount: number
  shortLinksCount: number
  searchTerm: string
  mode?: TypeFilter
  onCopy: (text: string) => void
  onDelete: (item: UnifiedItem) => Promise<void> | void
  onShowDetail: (item: UnifiedItem) => void
}

const sevenDays = 7 * 24 * 60 * 60 * 1000

function getItemStatus(item: UnifiedItem) {
  if (Date.now() - item.lastAccess > sevenDays) {
    return { label: '低活跃', color: 'orangered' }
  }

  return { label: '正常', color: 'green' }
}

function getItemLink(item: UnifiedItem) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const link = buildShareLink(item, origin)
  return { origin, link }
}

export function UnifiedTable({
  items,
  loading,
  recordsCount,
  shortLinksCount,
  searchTerm,
  mode = 'all',
  onCopy,
  onDelete,
  onShowDetail
}: UnifiedTableProps) {
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleItems = items.filter((item) => {
    if (mode !== 'all' && item.type !== mode) return false
    if (!normalizedSearch) return true

    return item.name.toLowerCase().includes(normalizedSearch) ||
      item.url.toLowerCase().includes(normalizedSearch)
  })

  const columns: ColumnProps<UnifiedItem>[] = [
    {
      title: '资源名称',
      dataIndex: 'name',
      width: 230,
      sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
      render: (_, item) => (
        <Space direction="vertical" size={2} className="table-primary-cell">
          <Space size={8}>
            <Tag color={item.type === 'convert' ? 'arcoblue' : 'purple'}>
              {item.type === 'convert' ? '订阅' : '短链'}
            </Tag>
            <Text bold ellipsis={{ showTooltip: true }} style={{ maxWidth: 150 }}>
              {item.name}
            </Text>
          </Space>
          <Text type="secondary" className="table-subtext">
            {item.type === 'convert' ? `${item.nodeCount ?? 0} 个节点 · ${item.clientType || 'unknown'}` : item.id}
          </Text>
        </Space>
      )
    },
    {
      title: '状态',
      width: 100,
      render: (_, item) => {
        const status = getItemStatus(item)
        return <Tag color={status.color}>{status.label}</Tag>
      }
    },
    {
      title: '原始地址',
      dataIndex: 'url',
      ellipsis: true,
      render: (_, item) => (
        <Tooltip content={item.url} mini>
          <Text className="mono-link">{formatCompactUrl(item.url)}</Text>
        </Tooltip>
      )
    },
    {
      title: '访问链接',
      width: 170,
      render: (_, item) => {
        const { origin, link } = getItemLink(item)
        return (
          <Button type="text" size="small" onClick={() => onCopy(link)}>
            {origin ? link.replace(origin, '') : link}
          </Button>
        )
      }
    },
    {
      title: '访问量',
      dataIndex: 'hits',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.hits - b.hits,
      render: (hits) => <Text className="number-cell">{Number(hits).toLocaleString()}</Text>
    },
    {
      title: '最后访问',
      dataIndex: 'lastAccess',
      width: 180,
      sorter: (a, b) => a.lastAccess - b.lastAccess,
      defaultSortOrder: 'descend',
      render: (_, item) => <Text type="secondary">{formatAdminDate(item.lastAccess)}</Text>
    },
    {
      title: '操作',
      width: 210,
      fixed: 'right',
      render: (_, item) => {
        const { link } = getItemLink(item)
        return (
          <Space size={4}>
            <Button size="small" type="text" icon={<IconCopy />} onClick={() => onCopy(link)}>
              复制
            </Button>
            <Button size="small" type="text" icon={<IconEye />} onClick={() => onShowDetail(item)}>
              详情
            </Button>
            <Popconfirm
              title={`删除${item.type === 'convert' ? '订阅' : '短链接'}`}
              content={`确定删除「${item.name}」吗？`}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ status: 'danger' }}
              onOk={() => onDelete(item)}
            >
              <Button size="small" type="text" status="danger" icon={<IconDelete />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  return (
    <div className="resource-table-card">
      <div className="table-meta-bar">
        <Space size={8} wrap>
          <Tag color="arcoblue">订阅 {recordsCount}</Tag>
          <Tag color="purple">短链 {shortLinksCount}</Tag>
          <Tag color="gray">当前 {visibleItems.length}</Tag>
        </Space>
      </div>

      <Table
        rowKey={(record) => `${record.type}-${record.id}`}
        columns={columns}
        data={visibleItems}
        loading={loading}
        border={false}
        hover
        tableLayoutFixed
        scroll={{ x: 1180 }}
        noDataElement={<Empty description={searchTerm ? '未找到匹配项' : '暂无管理数据'} />}
        pagination={{
          sizeCanChange: true,
          pageSize: 12,
          sizeOptions: [12, 24, 48],
          showTotal: true
        }}
      />
    </div>
  )
}
