import { useMemo, useState } from 'react'
import { Button, Chip, Skeleton } from '@heroui/react'
import type { ConvertRecord, ShortLink, SortDescriptor } from '../types'
import { EmptyState } from './EmptyState'

interface UnifiedItem {
  id: string
  name: string
  type: 'convert' | 'shortlink'
  url: string
  hits: number
  lastAccess: number
  clientType?: string
  nodeCount?: number
}

interface UnifiedTableProps {
  records: ConvertRecord[]
  shortLinks: ShortLink[]
  loading: boolean
  onDeleteRecord: (id: string) => void
  onDeleteShortLink: (id: string) => void
  onCopy: (text: string) => void
  searchTerm: string
}

export function UnifiedTable({
  records,
  shortLinks,
  loading,
  onDeleteRecord,
  onDeleteShortLink,
  onCopy,
  searchTerm
}: UnifiedTableProps) {
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'lastAccess',
    direction: 'descending'
  })

  const rowsPerPage = 15

  // 合并数据
  const allItems: UnifiedItem[] = useMemo(() => {
    const convertItems: UnifiedItem[] = records.map(r => ({
      id: r.id,
      name: r.name,
      type: 'convert' as const,
      url: r.originalUrl,
      hits: r.hits,
      lastAccess: r.lastAccess,
      clientType: r.clientType,
      nodeCount: r.nodeCount
    }))

    const shortLinkItems: UnifiedItem[] = shortLinks.map(s => ({
      id: s.id,
      name: s.name,
      type: 'shortlink' as const,
      url: s.targetUrl,
      hits: s.hits,
      lastAccess: s.lastAccess
    }))

    return [...convertItems, ...shortLinkItems]
  }, [records, shortLinks])

  // 过滤和排序
  const filteredItems = useMemo(() => {
    let filtered = allItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.url.toLowerCase().includes(searchTerm.toLowerCase())
    )

    filtered.sort((a, b) => {
      const column = sortDescriptor.column as keyof UnifiedItem
      let first = a[column]
      let second = b[column]

      if (first === undefined) first = ''
      if (second === undefined) second = ''

      if (typeof first === 'string') first = first.toLowerCase()
      if (typeof second === 'string') second = second.toLowerCase()

      const cmp = first < second ? -1 : first > second ? 1 : 0
      return sortDescriptor.direction === 'descending' ? -cmp : cmp
    })

    return filtered
  }, [allItems, searchTerm, sortDescriptor])

  // 分页
  const pages = Math.ceil(filteredItems.length / rowsPerPage)
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredItems.slice(start, end)
  }, [page, filteredItems])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url)
      const path = u.pathname.length > 15 ? u.pathname.slice(0, 15) + '...' : u.pathname
      return `${u.hostname}${path}`
    } catch {
      return url.length > 30 ? url.slice(0, 30) + '...' : url
    }
  }

  const handleSort = (column: string) => {
    setSortDescriptor(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'ascending'
        ? 'descending'
        : 'ascending'
    }))
  }

  const getSortIndicator = (column: string) => {
    if (sortDescriptor.column !== column) return null
    return sortDescriptor.direction === 'ascending' ? '↑' : '↓'
  }

  const getLink = (item: UnifiedItem) => {
    return item.type === 'convert'
      ? `${window.location.origin}/sub/${item.id}`
      : `${window.location.origin}/s/${item.id}`
  }

  const handleDelete = (item: UnifiedItem) => {
    if (item.type === 'convert') {
      onDeleteRecord(item.id)
    } else {
      onDeleteShortLink(item.id)
    }
  }

  return (
    <div className="table-card">
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th
                className={sortDescriptor.column === 'name' ? 'sorted' : ''}
                onClick={() => handleSort('name')}
              >
                名称
                <span className="sort-indicator">{getSortIndicator('name')}</span>
              </th>
              <th>原始链接</th>
              <th>短链接</th>
              <th
                className={sortDescriptor.column === 'hits' ? 'sorted' : ''}
                onClick={() => handleSort('hits')}
              >
                访问
                <span className="sort-indicator">{getSortIndicator('hits')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'lastAccess' ? 'sorted' : ''}
                onClick={() => handleSort('lastAccess')}
              >
                最后访问
                <span className="sort-indicator">{getSortIndicator('lastAccess')}</span>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td><Skeleton className="h-4 w-32 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-40 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-24 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-12 rounded-lg" /></td>
                  <td><Skeleton className="h-4 w-36 rounded-lg" /></td>
                  <td>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-14 rounded-lg" />
                      <Skeleton className="h-8 w-14 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td className="cell-name">{item.name}</td>
                  <td>
                    <span className="cell-url" title={item.url}>
                      {formatUrl(item.url)}
                    </span>
                  </td>
                  <td>
                    <span className="short-link" onClick={() => onCopy(getLink(item))}>
                      {getLink(item).replace(window.location.origin, '')}
                    </span>
                  </td>
                  <td className="cell-number">{item.hits}</td>
                  <td className="cell-date">{formatDate(item.lastAccess)}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => onCopy(getLink(item))}
                      >
                        复制
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => handleDelete(item)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={searchTerm ? '未找到匹配项' : '暂无数据'}
                    description={searchTerm ? '尝试其他关键词' : '开始使用服务后，数据将显示在这里'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pagination">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page === 1}
            onPress={() => setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="pagination-info">
            第 {page} / {pages} 页
          </span>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page === pages}
            onPress={() => setPage(p => Math.min(pages, p + 1))}
          >
            下一页
          </Button>
        </div>
      )}

      <div className="record-count">
        共 {filteredItems.length} 条数据
        {searchTerm && ` (筛选自 ${allItems.length} 条)`}
      </div>
    </div>
  )
}
