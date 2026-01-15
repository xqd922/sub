import { useMemo, useState } from 'react'
import type { ConvertRecord, SortDescriptor } from '../types'
import { EmptyState } from './EmptyState'

interface RecordsTableProps {
  records: ConvertRecord[]
  loading: boolean
  onDelete: (id: string) => void
  onCopy: (text: string) => void
  searchTerm: string
}

export function RecordsTable({
  records,
  loading,
  onDelete,
  onCopy,
  searchTerm
}: RecordsTableProps) {
  const [page, setPage] = useState(1)
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'lastAccess',
    direction: 'descending'
  })

  const rowsPerPage = 10

  // 过滤和排序
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.originalUrl.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // 排序
    filtered.sort((a, b) => {
      const column = sortDescriptor.column as keyof ConvertRecord
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
  }, [records, searchTerm, sortDescriptor])

  // 分页
  const pages = Math.ceil(filteredRecords.length / rowsPerPage)
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredRecords.slice(start, end)
  }, [page, filteredRecords])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url)
      return `${u.hostname}${u.pathname.slice(0, 20)}...`
    } catch {
      return url.slice(0, 30) + '...'
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

  const getClientBadgeClass = (clientType: string) => {
    const type = clientType.toLowerCase()
    if (type.includes('clash')) return 'cell-badge clash'
    if (type.includes('sing')) return 'cell-badge singbox'
    return 'cell-badge'
  }

  return (
    <div>
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
              <th
                className={sortDescriptor.column === 'clientType' ? 'sorted' : ''}
                onClick={() => handleSort('clientType')}
              >
                客户端
                <span className="sort-indicator">{getSortIndicator('clientType')}</span>
              </th>
              <th
                className={sortDescriptor.column === 'nodeCount' ? 'sorted' : ''}
                onClick={() => handleSort('nodeCount')}
              >
                节点数
                <span className="sort-indicator">{getSortIndicator('nodeCount')}</span>
              </th>
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
              <tr>
                <td colSpan={7}>
                  <EmptyState title="加载中..." />
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((record) => (
                <tr key={record.id}>
                  <td className="cell-name">{record.name}</td>
                  <td>
                    <span className="cell-url" title={record.originalUrl}>
                      {formatUrl(record.originalUrl)}
                    </span>
                  </td>
                  <td>
                    <span className={getClientBadgeClass(record.clientType)}>
                      {record.clientType}
                    </span>
                  </td>
                  <td className="cell-number">{record.nodeCount}</td>
                  <td className="cell-number">{record.hits}</td>
                  <td className="cell-date">{formatDate(record.lastAccess)}</td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="action-btn copy"
                        onClick={() => onCopy(`${window.location.origin}/sub/${record.id}`)}
                      >
                        复制
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => onDelete(record.id)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title={searchTerm ? '未找到匹配的记录' : '暂无记录'}
                    description={searchTerm ? '尝试使用其他关键词搜索' : '开始使用订阅转换服务后，记录将显示在这里'}
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
        共 {filteredRecords.length} 条记录
        {searchTerm && ` (筛选自 ${records.length} 条)`}
      </div>
    </div>
  )
}
