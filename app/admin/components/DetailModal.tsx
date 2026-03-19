import { createPortal } from 'react-dom'
import { Button } from '@heroui/react'

interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  onCopy: (text: string) => void
  item: {
    id: string
    name: string
    type: 'convert' | 'shortlink'
    url: string
    hits: number
    lastAccess: number
    clientType?: string
    nodeCount?: number
  } | null
}

export function DetailModal({ isOpen, onClose, onCopy, item }: DetailModalProps) {
  if (!isOpen || !item) return null

  const link = item.type === 'convert'
    ? `${window.location.origin}/sub/${item.id}`
    : `${window.location.origin}/s/${item.id}`

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN')

  return createPortal(
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="detail-title">{item.name}</h3>
        <div className="detail-list">
          <div className="detail-row">
            <span className="detail-label">类型</span>
            <span className="detail-value">{item.type === 'convert' ? '订阅转换' : '短链接'}</span>
          </div>

          {item.type === 'convert' && item.clientType && (
            <div className="detail-row">
              <span className="detail-label">客户端</span>
              <span className="detail-value">{item.clientType}</span>
            </div>
          )}

          {item.type === 'convert' && item.nodeCount !== undefined && (
            <div className="detail-row">
              <span className="detail-label">节点数</span>
              <span className="detail-value">{item.nodeCount}</span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">访问次数</span>
            <span className="detail-value">{item.hits}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">最后访问</span>
            <span className="detail-value">{formatDate(item.lastAccess)}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">原始链接</span>
            <div className="detail-url-box">
              <span className="detail-url">{item.url}</span>
              <Button size="sm" variant="secondary" onPress={() => onCopy(item.url)}>
                复制
              </Button>
            </div>
          </div>

          <div className="detail-row">
            <span className="detail-label">{item.type === 'convert' ? '转换链接' : '短链接'}</span>
            <div className="detail-url-box">
              <span className="detail-url">{link}</span>
              <Button size="sm" variant="secondary" onPress={() => onCopy(link)}>
                复制
              </Button>
            </div>
          </div>
        </div>

        <div className="detail-footer">
          <Button variant="secondary" onPress={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
