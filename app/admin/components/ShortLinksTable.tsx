import { useMemo, useState } from 'react'
import type { ShortLink, SortDescriptor } from '../types'
import { EmptyState } from './EmptyState'

interface ShortLinksTableProps {
  shortLinks: ShortLink[]
  loading: boolean
  onDelete: (id: string) => void
  onCopy: (text: string) => void
  searchTerm: string
}

export function ShortLinksTable({
  shortLinks,
  loading,
  onDelete,
  onCopy,
  searchTerm
}: ShortLinksTableProps) {
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'createdAt',
    direction: 'descending'
  })

  const rowsPerPage = 10

  // 过滤和排序
  const filteredLinks = useMemo(() => {
    let filtered = shortLinks.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // 排序
    filtered.sort((a, b) => {
      const column = sortDescriptor.column as keyof ShortLink
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
  }, [shortLinks, searchTerm, sortDescriptor])

  // 分页
  const pages = Math.ceil(filteredLinks.length / rowsPerPage)
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredLinks.slice(start, end)
  }, [page, filteredLinks])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
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

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th
                className={sortDescriptor.column === 'id' ? 'sorted' : ''}
                onClick={() => handleSort('id')}
              >
                短链接
                <span className="sort-indicator">{getSortIndicator('id')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'name' ? 'sorted' : ''}
                onClick={() => handleSort('name')}
              >
                名称
                <span className="sort-indicator">{getSortIndicator('name')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'hits' ? 'sorted' : ''}
                onClick={() => handleSort('hits')}
              >
                访问次数
                <span className="sort-indicator">{getSortIndicator('hits')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'createdAt' ? 'sorted' : ''}
                onClick={() => handleSort('createdAt')}
              >
                创建时间
                <span className="sort-indicator">{getSortIndicator('createdAt')}</span>
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
              <tr>
                <td colSpan={6}>
                  <EmptyState title="加载中..." />
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((link) => (
                <tr key={link.id}>
                  <td>
                    <span className="cell-badge">/s/{link.id}</span>
                  </td>
                  <td className="cell-name">{link.name}</td>
                  <td className="cell-number">{link.hits}</td>
                  <td className="cell-date">{formatDate(link.createdAt)}</td>
                  <td className="cell-date">{formatDate(link.lastAccess)}</td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="action-btn copy"
                        onClick={() => onCopy(`${window.location.origin}/s/${link.id}`)}
                      >
                        复制
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => onDelete(link.id)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={searchTerm ? '未找到匹配的短链接' : '暂无短链接'}
                    description={searchTerm ? '尝试使用其他关键词搜索' : '创建短链接后，将显示在这里'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span className="pagination-info">
            第 {page} / {pages} 页
          </span>
          <button
            className="pagination-btn"
            disabled={page === pages}
            onClick={() => setPage(p => Math.min(pages, p + 1))}
          >
            下一页
          </button>
        </div>
      )}

      <div className="record-count">
        共 {filteredLinks.length} 个短链接
        {searchTerm && ` (筛选自 ${shortLinks.length} 个)`}
      </div>
    </div>
  )
}
