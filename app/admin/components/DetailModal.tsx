import { Button, Descriptions, Drawer, Space, Tag, Typography } from '@arco-design/web-react'
import { IconCopy, IconLink } from '@arco-design/web-react/icon'
import type { UnifiedItem } from '../types'
import { buildShareLink, formatAdminDate } from '../utils/items'

const { Paragraph, Text } = Typography

interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  onCopy: (text: string) => void
  item: UnifiedItem | null
}

export function DetailModal({ isOpen, onClose, onCopy, item }: DetailModalProps) {
  if (!item) return null

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const link = buildShareLink(item, origin)

  const detailData = [
    {
      label: '资源类型',
      value: <Tag color={item.type === 'convert' ? 'arcoblue' : 'purple'}>{item.type === 'convert' ? '订阅转换' : '短链接'}</Tag>
    },
    ...(item.type === 'convert' ? [
      { label: '客户端', value: item.clientType || 'unknown' },
      { label: '节点数', value: item.nodeCount ?? 0 }
    ] : []),
    { label: '访问次数', value: item.hits.toLocaleString() },
    { label: '最后访问', value: formatAdminDate(item.lastAccess) }
  ]

  return (
    <Drawer
      className="admin-detail-drawer"
      width={520}
      visible={isOpen}
      title="资源详情"
      footer={null}
      onCancel={onClose}
    >
      <Space direction="vertical" size={20} className="drawer-content">
        <div>
          <Text type="secondary">资源名称</Text>
          <h2 className="drawer-title">{item.name}</h2>
        </div>

        <Descriptions
          column={1}
          border
          data={detailData}
          labelStyle={{ width: 110 }}
        />

        <div className="drawer-link-section">
          <Text type="secondary">原始链接</Text>
          <Paragraph className="drawer-link-box" copyable={{ text: item.url }}>
            {item.url}
          </Paragraph>
          <Button icon={<IconCopy />} onClick={() => onCopy(item.url)}>
            复制原始链接
          </Button>
        </div>

        <div className="drawer-link-section">
          <Text type="secondary">访问链接</Text>
          <Paragraph className="drawer-link-box" copyable={{ text: link }}>
            {link}
          </Paragraph>
          <Space>
            <Button type="primary" icon={<IconCopy />} onClick={() => onCopy(link)}>
              复制访问链接
            </Button>
            <Button icon={<IconLink />} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
              打开
            </Button>
          </Space>
        </div>
      </Space>
    </Drawer>
  )
}
