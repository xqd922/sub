import { createPortal } from 'react-dom'
import { Button } from '@heroui/react'
import type { UnifiedItem } from '../types'
import { buildShareLink, formatAdminDate } from '../utils/items'

interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  onCopy: (text: string) => void
  item: UnifiedItem | null
}

export function DetailModal({ isOpen, onClose, onCopy, item }: DetailModalProps) {
  if (!isOpen || !item) return null

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const link = buildShareLink(item, origin)

  return createPortal(
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={(event) => event.stopPropagation()}>
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
            <span className="detail-value">{formatAdminDate(item.lastAccess)}</span>
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
